"""The gateway configured with DIAN_GATEWAY, and the real one: UBL, XAdES-EPES signature and SOAP to the DIAN.

The signed XML of a document is built and stored once. Retries resend the same bytes, so its number, CUFE/CUDE and
signature never change (DIAN regla 90). If a first attempt reached the DIAN but its answer was lost, the retry is
answered with rule 90 and the real outcome is read with GetStatus.

The only new signature is the one of DIAN contingency (annex §12.2): the invoice is signed again as type 04 with the
same number and CUFE, and from then on that XML, the most recent one, is the one sent.
"""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from lxml import etree

from dian import signing, soap
from dian.gateway import (
    ContingencyDocument,
    DianGateway,
    GatewayRefused,
    GatewayResult,
    Submission,
)
from dian.simulated import SimulatedGateway
from dian.ubl.common import NS
from dian.ubl.invoice import build_invoice
from dian.ubl.notes import build_note
from fiscal_app.models import Document, Issuer, SoftwareRegistration
from fiscal_app.models.choices import ArtifactKind, DocumentKind
from fiscal_app.services import artifacts
from fiscal_app.services.certificates import active_certificate, credentials_of
from fiscal_app.services.ubl_mapping import (
    document_spec,
    invoice_reference,
    resolution_of,
)


def get_gateway(name: str) -> DianGateway:
    if name == 'soap':
        return SoapGateway()
    return SimulatedGateway()


class SoapGateway(DianGateway):
    def __init__(self, client_factory=None):
        self.client_factory = client_factory or (
            lambda credentials, environment: soap.DianClient(
                credentials, environment, url=settings.DIAN_WS_URLS.get(environment) or None
            )
        )

    def send(self, submission: Submission) -> GatewayResult:
        document, software, credentials = _prepare(submission)
        try:
            signed_xml = signed_xml_of(document, software, credentials)
        except signing.SigningError as error:
            raise GatewayRefused(f'No se pudo firmar: {error}') from error
        code, qr_url, invoice_type = codes_of(signed_xml)
        xml_name, zip_name = soap.file_names(
            document.kind, document.issuer.nit, timezone.localdate().year, next_file_sequence(document.issuer_id)
        )
        client = self.client_factory(credentials, document.issuer.environment)
        try:
            response = client.send_bill_sync(zip_name, soap.zip_document(xml_name, signed_xml))
            if not response.is_valid and response.already_processed:
                response = client.get_status(code)
        except soap.DianServiceError as error:
            raise GatewayRefused(str(error)) from error
        return GatewayResult(
            state='validated' if response.is_valid else 'rejected',
            cufe=code,
            qr_url=qr_url,
            errors=_errors(response),
            signed_xml=signed_xml,
            dian_response=response.application_response or response.raw,
            invoice_type=invoice_type,
        )

    def prepare_contingency(self, submission: Submission) -> ContingencyDocument | None:
        """Sign a sale invoice again as type 04; notes and paper transcriptions (03) have no DIAN contingency."""
        document, software, credentials = _prepare(submission)
        if document.kind != DocumentKind.INVOICE or (document.invoice_type or default_invoice_type(document)) != '01':
            return None
        try:
            signed_xml = signed_xml_of(document, software, credentials, invoice_type='04')
        except signing.SigningError as error:
            raise GatewayRefused(f'No se pudo firmar la factura de contingencia: {error}') from error
        code, qr_url, _invoice_type = codes_of(signed_xml)
        return ContingencyDocument(signed_xml=signed_xml, cufe=code, qr_url=qr_url)


def _prepare(submission):
    """The document, the issuer's software in its environment and its signing credentials."""
    document = Document.objects.select_related('issuer', 'numbering_range', 'original').get(pk=submission.document_id)
    software = (
        SoftwareRegistration.objects.filter(issuer=document.issuer, environment=document.issuer.environment, active=True)
        .order_by('-created_at').first()
    )
    certificate = active_certificate(document.issuer)
    if software is None or certificate is None:
        raise GatewayRefused('El emisor no tiene certificado activo o software registrado en su ambiente.')
    try:
        return document, software, credentials_of(certificate)
    except signing.SigningError as error:
        raise GatewayRefused(f'No se pudo abrir el certificado: {error}') from error


def signed_xml_of(document: Document, software: SoftwareRegistration, credentials: signing.SigningCredentials,
                  invoice_type: str | None = None) -> bytes:
    """The latest signed XML of the document; a new one is built, signed and stored before it is sent.

    Without `invoice_type`, an already signed document is never signed again. With it (the type-04 re-signature), a
    new XML is always signed and becomes the latest.
    """
    stored = document.artifacts.filter(kind=ArtifactKind.SIGNED_XML).order_by('-created_at', '-id').first()
    if stored is not None and invoice_type is None:
        return artifacts.read(stored)
    spec = document_spec(document, software)
    if document.kind == DocumentKind.INVOICE:
        built = build_invoice(spec, resolution_of(document.numbering_range), invoice_type or default_invoice_type(document))
    else:
        built = build_note(document.kind, spec, invoice_reference(document))
    signing.sign(built.root, credentials, timezone.now())
    content = built.tostring()
    artifacts.store(document, ArtifactKind.SIGNED_XML, content, 'application/xml')
    return content


def default_invoice_type(document: Document) -> str:
    """03 for the transcription of a paper invoice of the issuer's contingency (annex §12.1), 01 otherwise."""
    return '03' if document.payload.get('issuer_contingency') else '01'


def codes_of(signed_xml: bytes) -> tuple[str, str, str]:
    """CUFE/CUDE (cbc:UUID), QR URL (sts:QRCode) and InvoiceTypeCode (empty for notes) of a signed document."""
    root = etree.fromstring(signed_xml)
    return (
        root.findtext('cbc:UUID', namespaces=NS), root.findtext('.//sts:QRCode', namespaces=NS),
        root.findtext('cbc:InvoiceTypeCode', namespaces=NS) or '',
    )


def next_file_sequence(issuer_id: int) -> int:
    """Next consecutive of the files the issuer sends to the DIAN this year (§6.5.7)."""
    year = timezone.localdate().year
    with transaction.atomic():
        issuer = Issuer.objects.select_for_update().get(pk=issuer_id)
        if issuer.dian_file_year != year:
            issuer.dian_file_year, issuer.dian_file_sequence = year, 0
        issuer.dian_file_sequence += 1
        issuer.save(update_fields=['dian_file_year', 'dian_file_sequence', 'updated_at'])
    return issuer.dian_file_sequence


def _errors(response: soap.DianResponse) -> list[dict]:
    errors = [message.as_dict() for message in response.messages]
    if not response.is_valid and not any(message.rejection for message in response.messages):
        # A rejection without rules (status 66/90/99 alone) still has to say why.
        errors.append({
            'rule': response.status_code, 'severity': 'rechazo',
            'message': response.status_description or response.status_message or 'Rechazado por la DIAN.',
        })
    return errors

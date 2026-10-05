"""What the buyer receives: the signed AttachedDocument and the graphical representation (PDF).

They are built when the DIAN validates a document and when an invoice is issued in DIAN contingency (type 04, without
ApplicationResponse). Handing them to the buyer (e-mail or print) is the client system's job.
"""

import logging
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone
from lxml import etree

from dian import signing
from dian.representation import Manufacturer, render_pdf
from dian.ubl.attached import build_attached_document, is_ubl_document
from fiscal_app.models import Document, SoftwareRegistration
from fiscal_app.models.choices import ArtifactKind
from fiscal_app.services import artifacts
from fiscal_app.services.certificates import active_certificate, credentials_of

logger = logging.getLogger(__name__)
COLOMBIA = ZoneInfo(settings.BUSINESS_TIME_ZONE)
APPLICATION_RESPONSE = '{urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2}ApplicationResponse'


def build_delivery(document: Document) -> bool:
    """Store the AttachedDocument and the PDF of the document's latest signed XML. False when there is nothing to build.

    A document of the simulated gateway has no UBL; an issuer without certificate cannot sign the container.
    """
    signed = _latest(document, ArtifactKind.SIGNED_XML)
    if signed is None or not is_ubl_document(signed):
        return False
    certificate = active_certificate(document.issuer)
    software = (
        SoftwareRegistration.objects.filter(issuer=document.issuer, environment=document.issuer.environment)
        .order_by('-active', '-created_at').first()
    )
    if certificate is None or software is None:
        logger.warning('Documento %s sin certificado o software: no se arma la entrega.', document.pk)
        return False
    now = timezone.localtime(timezone.now(), COLOMBIA)
    container = build_attached_document(signed, _application_response(document), now)
    signing.sign(container.root, credentials_of(certificate), timezone.now())
    artifacts.store(document, ArtifactKind.ATTACHED_DOCUMENT, container.tostring(), 'application/xml')
    manufacturer = Manufacturer(
        nit=software.manufacturer_nit or settings.FISCAL_MANUFACTURER_NIT,
        name=software.manufacturer_name, software=software.software_name,
    )
    pdf = render_pdf(signed, manufacturer, validated_at=_local(document.validated_at))
    artifacts.store(document, ArtifactKind.PDF, pdf, 'application/pdf')
    return True


def _application_response(document):
    """The DIAN's ApplicationResponse of a validated document; None in contingency or when the answer is not UBL."""
    if document.validated_at is None:
        return None
    content = _latest(document, ArtifactKind.DIAN_RESPONSE)
    if not content:
        return None
    try:
        return content if etree.fromstring(content).tag == APPLICATION_RESPONSE else None
    except etree.XMLSyntaxError:
        return None


def _latest(document, kind):
    stored = document.artifacts.filter(kind=kind).order_by('-created_at', '-id').first()
    return artifacts.read(stored) if stored is not None else None


def _local(moment):
    return timezone.localtime(moment, COLOMBIA) if moment else None

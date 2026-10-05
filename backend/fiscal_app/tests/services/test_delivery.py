"""Tests for what the buyer receives: the AttachedDocument (annex §6.4) and the PDF with the QR (annex §11.7)."""

import base64
import copy
import re
import zlib
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from lxml import etree

from dian import representation, signing, soap
from dian.representation import Manufacturer, qr_content, render_pdf
from dian.ubl.attached import AD_NAMESPACE
from dian.ubl.common import NS
from dian.xsd import errors
from fiscal_app.models import Document
from fiscal_app.models.choices import ArtifactKind, DocumentState
from fiscal_app.services import artifacts, delivery
from fiscal_app.services.document_validation import validate_document
from fiscal_app.services.emission import transmit
from fiscal_app.services.gateways import SoapGateway
from fiscal_app.tests.conftest import restaurant_bill
from fiscal_app.tests.dian_answers import (
    APPLICATION_RESPONSE,
    FakeSession,
    Reply,
    answer,
    dian_response,
)

ISSUED = datetime(2026, 10, 4, 13, 5, tzinfo=ZoneInfo('America/Bogota'))
AD = {**NS, 'ad': AD_NAMESPACE}
ACCEPTED = answer('SendBillSync', dian_response('SendBillSyncResult', valid=True, code='00', rules=[], xml=APPLICATION_RESPONSE))
REJECTED = answer('SendBillSync', dian_response('SendBillSyncResult', valid=False, code='99',
                                                rules=['Regla: FAD06, Rechazo: Valor incorrecto']))
MANUFACTURER = Manufacturer(nit='900373115', name='ProjectApp', software='Fiscal.')


def gateway(*replies):
    session = FakeSession(*replies)
    return SoapGateway(lambda credentials, environment: soap.DianClient(credentials, environment, session=session))


@pytest.fixture
def invoice(ready_issuer, make_document):
    payload, problems = validate_document('invoice', restaurant_bill())
    assert problems == []
    return make_document(payload=payload, issue_datetime=ISSUED, next_attempt_at=ISSUED)


def latest(document, kind) -> bytes:
    return artifacts.read(document.artifacts.filter(kind=kind).order_by('-id').first())


def pdf_text(pdf: bytes) -> str:
    """The decoded content streams of a ReportLab PDF (ASCII85 and Flate), enough to look for the printed text."""
    chunks = []
    for stream in re.findall(rb'stream\r?\n(.*?)endstream', pdf, re.DOTALL):
        data = stream.strip()
        if data.endswith(b'~>'):
            data = base64.a85decode(data, adobe=True) if data.startswith(b'<~') else base64.a85decode(data[:-2])
        try:
            chunks.append(zlib.decompress(data))
        except zlib.error:
            chunks.append(data)
    return b'\n'.join(chunks).decode('latin-1')


@pytest.mark.django_db
def test_validated_invoice_gets_a_valid_signed_container(invoice):
    """Fails if the AttachedDocument of a validated invoice breaks the official XSD or is not signed by the issuer."""
    document = transmit(invoice.pk, gateway(Reply(200, ACCEPTED)))

    container = etree.fromstring(latest(document, ArtifactKind.ATTACHED_DOCUMENT))

    assert errors(container) == []
    assert signing.verify(container).subject.rfc4514_string() == 'CN=Restaurante de Prueba SAS'


@pytest.mark.django_db
def test_container_carries_the_invoice_and_the_dian_answer(invoice):
    """Fails if the container does not hold the exact signed invoice and the DIAN's answer with its result (AE33–AE55)."""
    document = transmit(invoice.pk, gateway(Reply(200, ACCEPTED)))

    container = etree.fromstring(latest(document, ArtifactKind.ATTACHED_DOCUMENT))
    embedded = container.findtext('cac:Attachment/cac:ExternalReference/cbc:Description', namespaces=AD)
    line = container.find('cac:ParentDocumentLineReference/cac:DocumentReference', AD)

    assert embedded.encode() == latest(document, ArtifactKind.SIGNED_XML)
    assert line.findtext('cbc:UUID', namespaces=AD) == document.cufe
    assert line.findtext('cac:ResultOfVerification/cbc:ValidationResultCode', namespaces=AD) == '02'
    assert line.findtext('cac:ResultOfVerification/cbc:ValidationTime', namespaces=AD) == '13:06:31-05:00'
    assert container.findtext('cbc:ParentDocumentID', namespaces=AD) == document.full_number


@pytest.mark.django_db
def test_container_parties_are_the_invoice_parties(invoice):
    """Fails if sender and receiver of the container differ from the issuer and the buyer of the invoice."""
    document = transmit(invoice.pk, gateway(Reply(200, ACCEPTED)))

    container = etree.fromstring(latest(document, ArtifactKind.ATTACHED_DOCUMENT))
    signed = etree.fromstring(latest(document, ArtifactKind.SIGNED_XML))

    for container_party, invoice_party in (('SenderParty', 'AccountingSupplierParty'), ('ReceiverParty', 'AccountingCustomerParty')):
        sent = container.find(f'cac:{container_party}/cac:PartyTaxScheme/cbc:CompanyID', AD)
        original = signed.find(f'cac:{invoice_party}/cac:Party/cac:PartyTaxScheme/cbc:CompanyID', NS)
        assert (sent.text, dict(sent.attrib)) == (original.text, dict(original.attrib))


@pytest.mark.django_db
def test_contingency_invoice_is_delivered_without_dian_answer(invoice):
    """Fails if the type-04 container claims a DIAN validation it never had (§12.2: «sin Application Response»)."""
    dian = gateway(*[Reply(503, b'')] * 4)
    for _ in range(4):
        Document.objects.filter(pk=invoice.pk).update(state=DocumentState.TRANSMITTING)
        document = transmit(invoice.pk, dian)

    container = etree.fromstring(latest(document, ArtifactKind.ATTACHED_DOCUMENT))

    assert document.state == DocumentState.CONTINGENCY_DIAN
    assert container.find('cac:ParentDocumentLineReference', AD) is None
    assert errors(container) == []
    assert 'tipo 04' in pdf_text(latest(document, ArtifactKind.PDF))


@pytest.mark.django_db
def test_rejected_invoice_is_not_delivered(invoice):
    """Fails if a container or PDF is produced for a document the DIAN rejected: it has no fiscal value."""
    document = transmit(invoice.pk, gateway(Reply(200, REJECTED)))

    assert not document.artifacts.filter(kind__in=[ArtifactKind.ATTACHED_DOCUMENT, ArtifactKind.PDF]).exists()


@pytest.mark.django_db
def test_simulated_document_has_nothing_to_deliver(queued_document):
    """Fails if Fiscal. tries to build a container out of the simulator's placeholder XML."""
    artifacts.store(queued_document, ArtifactKind.SIGNED_XML, b'<Simulated>{}</Simulated>', 'application/xml')

    assert delivery.build_delivery(queued_document) is False


@pytest.mark.django_db
def test_delivery_failure_keeps_the_validation(invoice, monkeypatch):
    """Fails if an error building the PDF or container undoes or hides the DIAN's validation."""
    def broken(document):
        raise RuntimeError('sin disco')

    monkeypatch.setattr(delivery, 'build_delivery', broken)

    document = transmit(invoice.pk, gateway(Reply(200, ACCEPTED)))

    assert document.state == DocumentState.VALIDATED
    assert document.events.last().detail['delivery_failed'] == 'RuntimeError: sin disco'


@pytest.mark.django_db
def test_pdf_shows_the_legal_data_of_the_invoice(invoice):
    """Fails if the PDF lacks the number, the CUFE, the issuer's NIT or the software manufacturer (num. 18)."""
    document = transmit(invoice.pk, gateway(Reply(200, ACCEPTED)))

    text = pdf_text(latest(document, ArtifactKind.PDF))

    assert latest(document, ArtifactKind.PDF).startswith(b'%PDF')
    for expected in (document.full_number, document.cufe, document.issuer.nit, 'Fabricante del software'):
        assert expected in text


@pytest.mark.django_db
def test_qr_is_drawn_on_every_page(invoice, monkeypatch):
    """Fails if a page of a long invoice comes out without the QR the annex requires on all pages (§11.7)."""
    document = transmit(invoice.pk, gateway(Reply(200, ACCEPTED)))
    root = etree.fromstring(latest(document, ArtifactKind.SIGNED_XML))
    line = root.find('cac:InvoiceLine', NS)
    for _ in range(80):
        line.addnext(copy.deepcopy(line))
    drawn = []
    original_draw = representation.renderPDF.draw
    monkeypatch.setattr(representation.renderPDF, 'draw', lambda *args: (drawn.append(1), original_draw(*args)))

    pdf = render_pdf(etree.tostring(root), MANUFACTURER)

    pages = len(re.findall(rb'/Type /Page\b', pdf))
    assert pages > 1
    assert len(drawn) == pages


@pytest.mark.django_db
def test_qr_content_follows_the_annex(invoice):
    """Fails if the QR text misses a field of §11.7 or the lookup URL of the CUFE."""
    document = transmit(invoice.pk, gateway(Reply(200, ACCEPTED)))
    data = representation._Read(etree.fromstring(latest(document, ArtifactKind.SIGNED_XML)))

    lines = qr_content(data).splitlines()

    assert [line.split(':')[0] for line in lines[:10]] == [
        'NumFac', 'FecFac', 'HorFac', 'NitFac', 'DocAdq', 'ValFac', 'ValIva', 'ValOtroIm', 'ValTolFac', 'CUFE',
    ]
    assert lines[-1] == document.qr_url

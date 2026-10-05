"""Tests for the real DIAN gateway inside the emission queue, against recorded answers (no network)."""

import io
import zipfile
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from freezegun import freeze_time
from lxml import etree
from requests import ReadTimeout

from dian import signing, soap
from dian.ubl.common import NS
from fiscal_app.models import Document, SoftwareRegistration
from fiscal_app.models.choices import ArtifactKind, DocumentState
from fiscal_app.services import artifacts
from fiscal_app.services.document_validation import validate_document
from fiscal_app.services.emission import transmit
from fiscal_app.services.gateways import SoapGateway, get_gateway, next_file_sequence
from fiscal_app.tests.conftest import restaurant_bill
from fiscal_app.tests.dian_answers import FakeSession, Reply, answer, dian_response

DUE = datetime(2026, 10, 4, 13, 6, tzinfo=ZoneInfo('America/Bogota'))
ACCEPTED = answer('SendBillSync', dian_response('SendBillSyncResult', valid=True, code='00', rules=[],
                                                xml=b'<ApplicationResponse>validado</ApplicationResponse>'))
REJECTED = answer('SendBillSync', dian_response('SendBillSyncResult', valid=False, code='99', rules=[
    'Regla: FAJ43b, Rechazo: Nombre informado No corresponde al registrado en el RUT.',
]))
ALREADY_PROCESSED = answer('SendBillSync', dian_response('SendBillSyncResult', valid=False, code='99', rules=[
    'Regla: 90, Rechazo: Documento procesado anteriormente.',
]))
STATUS_VALID = answer('GetStatus', dian_response('GetStatusResult', valid=True, code='00', rules=[],
                                                 xml=b'<ApplicationResponse>consultado</ApplicationResponse>'))


@pytest.fixture
def invoice(ready_issuer, make_document):
    """The restaurant bill of contract v1, queued and due."""
    payload, problems = validate_document('invoice', restaurant_bill())
    assert problems == []
    return make_document(payload=payload, next_attempt_at=DUE,
                         issue_datetime=datetime(2026, 10, 4, 13, 5, tzinfo=ZoneInfo('America/Bogota')))


def gateway(*replies):
    session = FakeSession(*replies)
    return SoapGateway(lambda credentials, environment: soap.DianClient(credentials, environment, session=session)), session


def sent_zip(request) -> zipfile.ZipFile:
    """The ZIP inside a recorded SendBillSync request."""
    import base64

    content = etree.fromstring(request['data']).findtext('.//{http://wcf.dian.colombia}contentFile')
    return zipfile.ZipFile(io.BytesIO(base64.b64decode(content)))


@pytest.mark.django_db
def test_accepted_invoice_is_validated_with_its_cufe(invoice):
    """Fails if a document the DIAN accepts is not validated with the CUFE and QR written in its signed XML."""
    dian, _session = gateway(Reply(200, ACCEPTED))

    document = transmit(invoice.pk, dian)

    signed = etree.fromstring(artifacts.read(document.artifacts.get(kind=ArtifactKind.SIGNED_XML)))
    assert document.state == DocumentState.VALIDATED
    assert document.cufe == signed.findtext('cbc:UUID', namespaces=NS)
    assert document.qr_url == signed.findtext('.//sts:QRCode', namespaces=NS)
    assert artifacts.read(document.artifacts.get(kind=ArtifactKind.DIAN_RESPONSE)) == b'<ApplicationResponse>validado</ApplicationResponse>'


@pytest.mark.django_db
@freeze_time('2026-10-04 18:00:00')
def test_sent_zip_holds_the_signed_invoice(invoice):
    """Fails if the DIAN receives anything but one signed XML named as the annex says (§6.5.7)."""
    dian, session = gateway(Reply(200, ACCEPTED))

    transmit(invoice.pk, dian)

    with sent_zip(session.requests[0]) as archive:
        (name,) = archive.namelist()
        assert name == f'fv{int(invoice.issuer.nit):010d}0002600000001.xml'
        assert signing.verify(etree.fromstring(archive.read(name))).subject.rfc4514_string() == 'CN=Restaurante de Prueba SAS'


@pytest.mark.django_db
def test_rejected_invoice_keeps_the_rules(invoice):
    """Fails if a rejection does not reach the document with each rule and its severity."""
    dian, _session = gateway(Reply(200, REJECTED))

    document = transmit(invoice.pk, dian)

    assert document.state == DocumentState.REJECTED
    assert document.errors == [{
        'rule': 'FAJ43b', 'severity': 'rechazo', 'message': 'Nombre informado No corresponde al registrado en el RUT.',
    }]


@pytest.mark.django_db
def test_retry_resends_the_same_signed_bytes(invoice):
    """Fails if a retry re-signs the document: its signature and CUFE must not change between attempts (rule 90)."""
    dian, session = gateway(ReadTimeout(), Reply(200, ACCEPTED))

    transmit(invoice.pk, dian)
    Document.objects.filter(pk=invoice.pk).update(state=DocumentState.TRANSMITTING)
    transmit(invoice.pk, dian)

    first, second = (sent_zip(request) for request in session.requests)
    assert first.read(first.namelist()[0]) == second.read(second.namelist()[0])
    assert invoice.artifacts.filter(kind=ArtifactKind.SIGNED_XML).count() == 1


@pytest.mark.django_db
def test_already_processed_document_reads_its_real_status(invoice):
    """Fails if a resent document answered with rule 90 is rejected instead of reading its status with GetStatus."""
    dian, session = gateway(Reply(200, ALREADY_PROCESSED), Reply(200, STATUS_VALID))

    document = transmit(invoice.pk, dian)

    assert document.state == DocumentState.VALIDATED
    assert f'<wcf:trackId>{document.cufe}</wcf:trackId>'.encode() in session.requests[1]['data']


@pytest.mark.django_db
def test_soap_fault_requeues_without_contingency(invoice):
    """Fails if a SOAP fault (a request defect) pushes the document toward DIAN contingency instead of an hourly retry."""
    fault = b'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault/></s:Body></s:Envelope>'
    dian, _session = gateway(Reply(400, fault))

    document = transmit(invoice.pk, dian)

    assert document.state == DocumentState.QUEUED
    assert document.transient_failures == 0
    assert 'gateway_refused' in document.events.last().detail


@pytest.mark.django_db
def test_issuer_without_software_is_refused(invoice):
    """Fails if a document is signed and sent although the issuer has no software registered in its environment."""
    SoftwareRegistration.objects.filter(issuer=invoice.issuer).update(active=False)
    dian, session = gateway()

    document = transmit(invoice.pk, dian)

    assert document.state == DocumentState.QUEUED
    assert session.requests == []


@pytest.mark.django_db
def test_credit_note_is_sent_with_its_cude(ready_issuer, make_document):
    """Fails if a credit note is not signed and sent as a CreditNote with the CUDE that references its invoice."""
    original = make_document(state=DocumentState.VALIDATED, cufe='a' * 96, idempotency_key='waiter:invoice')
    bill = restaurant_bill()
    bill['billing_reference'] = {'document_id': original.pk, 'concept_code': '2'}
    payload, problems = validate_document('credit_note', bill)
    assert problems == []
    note = make_document(idempotency_key='waiter:nc', kind='credit_note', prefix='NC', number=1, payload=payload,
                         original=original, numbering_range=None, next_attempt_at=DUE)
    dian, session = gateway(Reply(200, ACCEPTED))

    document = transmit(note.pk, dian)

    with sent_zip(session.requests[0]) as archive:
        root = etree.fromstring(archive.read(archive.namelist()[0]))
    assert archive.namelist()[0].startswith('nc')
    assert etree.QName(root).localname == 'CreditNote'
    assert root.find('cbc:UUID', NS).get('schemeName') == 'CUDE-SHA384'
    assert root.findtext('cac:BillingReference/cac:InvoiceDocumentReference/cbc:UUID', namespaces=NS) == 'a' * 96
    assert document.state == DocumentState.VALIDATED


@pytest.mark.django_db
def test_file_sequence_restarts_every_year(issuer):
    """Fails if the consecutive of files sent does not grow, or does not restart at 1 on 1 January (§6.5.7)."""
    with freeze_time('2026-12-31 12:00:00'):
        assert [next_file_sequence(issuer.pk) for _ in range(2)] == [1, 2]
    with freeze_time('2027-01-01 12:00:00'):
        assert next_file_sequence(issuer.pk) == 1


def test_configured_gateway_is_chosen_by_name():
    """Fails if DIAN_GATEWAY=soap does not select the real gateway."""
    assert isinstance(get_gateway('soap'), SoapGateway)

"""Tests for DIAN contingency (type 04, annex FE 1.9 §12.2 and §12.4) through the real gateway and recorded answers."""

import base64
import io
import json
import zipfile
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from lxml import etree

from dian import signing, soap
from dian.ubl.common import NS
from fiscal_app.models import Document, SoftwareRegistration
from fiscal_app.models.choices import ArtifactKind, DocumentState
from fiscal_app.services import artifacts
from fiscal_app.services.document_validation import validate_document
from fiscal_app.services.emission import transmit
from fiscal_app.services.gateways import SoapGateway
from fiscal_app.tests.conftest import restaurant_bill
from fiscal_app.tests.dian_answers import FakeSession, Reply, answer, dian_response

ISSUED = datetime(2026, 10, 4, 13, 5, tzinfo=ZoneInfo('America/Bogota'))
ACCEPTED = answer('SendBillSync', dian_response('SendBillSyncResult', valid=True, code='00', rules=[]))
DOWN = Reply(503, b'')
FAILURES_BEFORE_CONTINGENCY = 4  # the first attempt and three retries every 5 s (§12.4)


def gateway(*replies):
    session = FakeSession(*replies)
    return SoapGateway(lambda credentials, environment: soap.DianClient(credentials, environment, session=session)), session


def until_contingency(document, dian):
    for _ in range(FAILURES_BEFORE_CONTINGENCY):
        Document.objects.filter(pk=document.pk).update(state=DocumentState.TRANSMITTING)
        transmit(document.pk, dian)
    return Document.objects.get(pk=document.pk)


def signed_versions(document):
    return [etree.fromstring(artifacts.read(item)) for item in document.artifacts.filter(kind=ArtifactKind.SIGNED_XML).order_by('id')]


@pytest.fixture
def invoice(ready_issuer, make_document):
    payload, problems = validate_document('invoice', restaurant_bill())
    assert problems == []
    return make_document(payload=payload, issue_datetime=ISSUED, next_attempt_at=ISSUED)


@pytest.mark.django_db
def test_invoice_is_signed_again_as_type_04_with_the_same_cufe(invoice):
    """Fails if the contingency invoice changes number or CUFE, or is not type 04 (§12.2)."""
    dian, _session = gateway(*[DOWN] * FAILURES_BEFORE_CONTINGENCY)

    document = until_contingency(invoice, dian)

    first, contingency = signed_versions(document)
    assert document.state == DocumentState.CONTINGENCY_DIAN
    assert [root.findtext('cbc:InvoiceTypeCode', namespaces=NS) for root in (first, contingency)] == ['01', '04']
    assert first.findtext('cbc:ID', namespaces=NS) == contingency.findtext('cbc:ID', namespaces=NS)
    assert document.cufe == first.findtext('cbc:UUID', namespaces=NS) == contingency.findtext('cbc:UUID', namespaces=NS)
    assert document.invoice_type == '04'


@pytest.mark.django_db
def test_contingency_invoice_is_validly_signed(invoice):
    """Fails if the type-04 XML that goes to the buyer is not signed with the issuer's certificate."""
    dian, _session = gateway(*[DOWN] * FAILURES_BEFORE_CONTINGENCY)

    document = until_contingency(invoice, dian)

    assert signing.verify(signed_versions(document)[-1]).subject.rfc4514_string() == 'CN=Restaurante de Prueba SAS'


@pytest.mark.django_db
def test_evidence_of_the_failures_is_kept(invoice):
    """Fails if the evidence of the DIAN failures the annex asks to archive is not stored with the document."""
    dian, _session = gateway(*[DOWN] * FAILURES_BEFORE_CONTINGENCY)

    document = until_contingency(invoice, dian)

    evidence = json.loads(artifacts.read(document.artifacts.get(kind=ArtifactKind.EVIDENCE)))
    assert evidence['document'] == document.full_number
    assert len(evidence['failures']) == FAILURES_BEFORE_CONTINGENCY
    assert all('HTTP 503' in failure['dian_unavailable'] for failure in evidence['failures'])


@pytest.mark.django_db
def test_entering_contingency_is_announced_once_with_its_start(invoice):
    """Fails if the client system is not told (once) that the invoice can be delivered without validation."""
    invoice.client.webhook_url = 'https://waiter.local/fiscal/avisos/'
    invoice.client.save()
    dian, _session = gateway(*[DOWN] * (FAILURES_BEFORE_CONTINGENCY + 1))

    document = until_contingency(invoice, dian)
    transmit(document.pk, dian)  # a 30-minute poll that fails again

    notices = [delivery.payload['document'] for delivery in document.client.webhook_deliveries.all()]
    assert [(notice['state'], notice['invoice_type']) for notice in notices] == [('contingency_dian', '04')]
    assert notices[0]['contingency_started_at'] is not None


@pytest.mark.django_db
def test_poll_sends_the_type_04_and_validates_it(invoice):
    """Fails if, once the DIAN answers, Fiscal. sends the old type-01 XML instead of the type 04 the buyer received."""
    dian, session = gateway(*[DOWN] * FAILURES_BEFORE_CONTINGENCY, Reply(200, ACCEPTED))

    document = until_contingency(invoice, dian)
    document = transmit(document.pk, dian)

    content = etree.fromstring(session.requests[-1]['data']).findtext('.//{http://wcf.dian.colombia}contentFile')
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(content))) as archive:
        sent = etree.fromstring(archive.read(archive.namelist()[0]))
    assert sent.findtext('cbc:InvoiceTypeCode', namespaces=NS) == '04'
    assert (document.state, document.invoice_type) == (DocumentState.VALIDATED, '04')


@pytest.mark.django_db
def test_credit_note_waits_without_contingency(ready_issuer, make_document):
    """Fails if a note is re-signed for contingency: notes have no contingency scheme (§12.2) and must wait."""
    original = make_document(state=DocumentState.VALIDATED, cufe='a' * 96, idempotency_key='waiter:invoice')
    bill = restaurant_bill()
    bill['billing_reference'] = {'document_id': original.pk, 'concept_code': '2'}
    payload, _problems = validate_document('credit_note', bill)
    note = make_document(idempotency_key='waiter:nc', kind='credit_note', prefix='NC', number=1, payload=payload,
                         original=original, numbering_range=None, next_attempt_at=ISSUED)
    dian, _session = gateway(*[DOWN] * FAILURES_BEFORE_CONTINGENCY)

    document = until_contingency(note, dian)

    assert document.state == DocumentState.CONTINGENCY_DIAN
    assert (document.invoice_type, document.cufe) == ('', '')
    assert document.artifacts.filter(kind=ArtifactKind.SIGNED_XML).count() == 1


@pytest.mark.django_db
def test_contingency_without_credentials_keeps_waiting(invoice):
    """Fails if a contingency the issuer cannot sign (software removed) crashes instead of being recorded."""
    dian, _session = gateway(*[DOWN] * FAILURES_BEFORE_CONTINGENCY)
    for _ in range(FAILURES_BEFORE_CONTINGENCY - 1):
        Document.objects.filter(pk=invoice.pk).update(state=DocumentState.TRANSMITTING)
        transmit(invoice.pk, dian)
    SoftwareRegistration.objects.filter(issuer=invoice.issuer).update(active=False)

    document = transmit(invoice.pk, SoapGateway(lambda credentials, environment: None))

    assert document.state == DocumentState.QUEUED
    assert 'gateway_refused' in document.events.last().detail

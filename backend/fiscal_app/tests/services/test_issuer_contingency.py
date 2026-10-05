"""Tests for the issuer's contingency (type 03, annex FE 1.9 §12.1): transcription of paper invoices and the letter."""

import base64
import io
import zipfile
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from lxml import etree

from dian import soap
from dian.codes import cude
from dian.ubl.common import NS
from dian.ubl.invoice import code_input
from dian.xsd import errors
from fiscal_app.models import Document, NumberingRange, SoftwareRegistration
from fiscal_app.models.choices import DocumentState, RangeKind
from fiscal_app.services.contingency_letter import (
    draft_letter,
    paper_invoices,
    subject_of,
)
from fiscal_app.services.document_validation import validate_document
from fiscal_app.services.emission import transmit
from fiscal_app.services.gateways import SoapGateway
from fiscal_app.services.ubl_mapping import document_spec
from fiscal_app.tests.conftest import restaurant_bill
from fiscal_app.tests.dian_answers import FakeSession, Reply, answer, dian_response

PAPER_ISSUED = datetime(2026, 10, 3, 20, 15, tzinfo=ZoneInfo('America/Bogota'))
ACCEPTED = answer('SendBillSync', dian_response('SendBillSyncResult', valid=True, code='00', rules=[]))


@pytest.fixture
def contingency_range(issuer):
    """The paper or pad range the DIAN authorized for the issuer's contingency (no technical key)."""
    return NumberingRange.objects.create(
        issuer=issuer, kind=RangeKind.CONTINGENCY, resolution_number='18760000099', prefix='CONT', number_from=1,
        number_to=500, valid_from=date(2026, 1, 1), valid_to=date(2027, 12, 31),
    )


@pytest.fixture
def paper_invoice(ready_issuer, make_document, contingency_range):
    payload, problems = validate_document('invoice', restaurant_bill())
    assert problems == []
    payload['issuer_contingency'] = True
    return make_document(idempotency_key='waiter:papel-7', prefix='CONT', number=7, payload=payload,
                         numbering_range=contingency_range, issue_datetime=PAPER_ISSUED, next_attempt_at=PAPER_ISSUED)


def sent_invoice(*replies):
    session = FakeSession(*replies)
    dian = SoapGateway(lambda credentials, environment: soap.DianClient(credentials, environment, session=session))
    return dian, session


def sent_xml(request):
    content = etree.fromstring(request['data']).findtext('.//{http://wcf.dian.colombia}contentFile')
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(content))) as archive:
        return etree.fromstring(archive.read(archive.namelist()[0]))


@pytest.mark.django_db
def test_paper_invoice_is_transcribed_as_type_03_with_the_cude(paper_invoice):
    """Fails if a paper invoice is not sent as type 03 identified by the CUDE with the software PIN (§11.4, note 2)."""
    dian, session = sent_invoice(Reply(200, ACCEPTED))

    document = transmit(paper_invoice.pk, dian)

    root = sent_xml(session.requests[0])
    spec = document_spec(document, SoftwareRegistration.objects.get(issuer=document.issuer))
    assert root.findtext('cbc:InvoiceTypeCode', namespaces=NS) == '03'
    assert root.find('cbc:UUID', NS).get('schemeName') == 'CUDE-SHA384'
    assert document.cufe == cude(code_input(spec), spec.software.pin)
    assert (document.state, document.invoice_type) == (DocumentState.VALIDATED, '03')


@pytest.mark.django_db
def test_transcription_references_the_paper_invoice(paper_invoice):
    """Fails if the type 03 lacks the AdditionalDocumentReference to the paper invoice the DIAN requires (FAI01–FAI05)."""
    dian, session = sent_invoice(Reply(200, ACCEPTED))

    transmit(paper_invoice.pk, dian)

    reference = sent_xml(session.requests[0]).find('cac:AdditionalDocumentReference', NS)
    assert reference.findtext('cbc:ID', namespaces=NS) == 'CONT7'
    assert reference.findtext('cbc:IssueDate', namespaces=NS) == '2026-10-03'
    assert reference.find('cbc:UUID', NS).get('schemeName') == 'CUDE-SHA384'


@pytest.mark.django_db
def test_transcription_uses_the_contingency_authorization_and_the_xsd(paper_invoice):
    """Fails if the type 03 carries the normal range's authorization or breaks the official schemas."""
    dian, session = sent_invoice(Reply(200, ACCEPTED))

    transmit(paper_invoice.pk, dian)

    root = sent_xml(session.requests[0])
    assert root.findtext('.//sts:InvoiceControl/sts:InvoiceAuthorization', namespaces=NS) == '18760000099'
    assert errors(root) == []


@pytest.mark.django_db
def test_transcription_is_not_resigned_as_type_04(paper_invoice):
    """Fails if a paper invoice waiting for the DIAN is turned into a type 04: it was already delivered on paper."""
    dian, _session = sent_invoice(*[Reply(503, b'')] * 4)
    for _ in range(4):
        Document.objects.filter(pk=paper_invoice.pk).update(state=DocumentState.TRANSMITTING)
        document = transmit(paper_invoice.pk, dian)

    assert document.state == DocumentState.CONTINGENCY_DIAN
    assert document.invoice_type == ''
    assert document.artifacts.filter(kind='signed_xml').count() == 1


@pytest.mark.django_db
def test_letter_lists_the_paper_invoices_of_the_period(paper_invoice, make_document):
    """Fails if the letter's list includes normal invoices or paper invoices outside the declared period."""
    make_document(idempotency_key='waiter:normal', number=990_000_005, issue_datetime=PAPER_ISSUED)

    assert paper_invoices(paper_invoice.issuer, date(2026, 10, 3), date(2026, 10, 3)) == [paper_invoice]
    assert paper_invoices(paper_invoice.issuer, date(2026, 10, 4), date(2026, 10, 5)) == []


@pytest.mark.django_db
def test_letter_subject_follows_the_annex(paper_invoice):
    """Fails if the e-mail subject is not «NIT-DV; Nombre» as §12.1 asks."""
    issuer = paper_invoice.issuer

    draft = draft_letter(issuer, date(2026, 10, 3), date(2026, 10, 3), date(2026, 10, 4))

    assert draft.subject == subject_of(issuer) == f'{issuer.nit}-{issuer.dv}; {issuer.legal_name}'
    assert draft.recipient == 'contingencia.facturadorvp@dian.gov.co'
    assert (draft.invoices, draft.pdf[:4]) == (1, b'%PDF')

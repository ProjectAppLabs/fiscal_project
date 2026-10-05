"""Tests for the DIAN test set (SendTestSetAsync + GetStatusZip, annex FE 1.9 §7.9 and §7.12) with recorded answers."""

import base64
import io
import zipfile

import pytest
from lxml import etree

from dian import signing, soap
from dian.ubl.common import NS
from fiscal_app.models import SoftwareRegistration, TestSetRun
from fiscal_app.services import test_set
from fiscal_app.tests.dian_answers import FakeSession, Reply, answer

TEST_SET_ID = '4de36cb4-9973-4ea4-a156-34e909aa24dc'


def receipt(zip_key='358f9538-1f80-4ed5-a3f6-aaa1ef36bebd'):
    return Reply(200, answer('SendTestSetAsync', f'''<SendTestSetAsyncResult
 xmlns:b="http://schemas.datacontract.org/2004/07/UploadDocumentResponse"
 xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><b:ErrorMessageList i:nil="true"/>
<b:ZipKey>{zip_key}</b:ZipKey></SendTestSetAsyncResult>'''))


def zip_status(results):
    """GetStatusZip answer with one DianResponse per (code, valid, rules)."""
    items = ''.join(f'''<b:DianResponse><b:ErrorMessage xmlns:c="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
{''.join(f'<c:string>{rule}</c:string>' for rule in rules)}</b:ErrorMessage><b:IsValid>{'true' if valid else 'false'}</b:IsValid>
<b:StatusCode>{'00' if valid else '99'}</b:StatusCode><b:StatusDescription>x</b:StatusDescription>
<b:XmlDocumentKey>{code}</b:XmlDocumentKey></b:DianResponse>''' for code, valid, rules in results)
    return Reply(200, answer('GetStatusZip', f'''<GetStatusZipResult
 xmlns:b="http://schemas.datacontract.org/2004/07/DianResponse">{items}</GetStatusZipResult>'''))


def client_with(*replies):
    session = FakeSession(*replies)
    return (lambda credentials, environment: soap.DianClient(credentials, environment, session=session)), session


def sent_files(request):
    """{file name: XML root} of the ZIP inside a recorded SendTestSetAsync request."""
    content = etree.fromstring(request['data']).findtext('.//{http://wcf.dian.colombia}contentFile')
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(content))) as archive:
        return {name: etree.fromstring(archive.read(name)) for name in archive.namelist()}


@pytest.fixture
def habilitation_issuer(ready_issuer):
    SoftwareRegistration.objects.filter(issuer=ready_issuer).update(test_set_id=TEST_SET_ID)
    return ready_issuer


@pytest.mark.django_db
def test_readiness_names_what_is_missing(ready_issuer):
    """Fails if the checklist does not show that the TestSetId from the DIAN portal is missing."""
    assert test_set.readiness(ready_issuer) == {
        'environment': True, 'certificate': True, 'software': True, 'test_set_id': False, 'range': True,
    }


@pytest.mark.django_db
def test_set_is_not_started_for_an_issuer_that_is_not_ready(ready_issuer):
    """Fails if the set is sent without a TestSetId, which the DIAN would refuse."""
    with pytest.raises(test_set.TestSetError, match='TestSetId'):
        test_set.start(ready_issuer)


@pytest.mark.django_db
def test_invoices_go_first_signed_in_one_zip_with_the_test_set_id(habilitation_issuer):
    """Fails if the invoices of the set are not signed, named as §6.5.7 and sent with the issuer's TestSetId."""
    factory, session = client_with(receipt())

    run = test_set.start(habilitation_issuer, invoices=3, client_factory=factory)

    files = sent_files(session.requests[0])
    assert run.state == TestSetRun.State.PROCESSING
    assert f'<wcf:testSetId>{TEST_SET_ID}</wcf:testSetId>'.encode() in session.requests[0]['data']
    assert len(files) == 3 and all(name.startswith('fv') for name in files)
    assert all(signing.verify(root) for root in files.values())
    assert [root.findtext('cbc:ID', namespaces=NS) for root in files.values()] == ['SETP990000000', 'SETP990000001', 'SETP990000002']


@pytest.mark.django_db
def test_notes_follow_once_the_invoices_are_accepted(habilitation_issuer):
    """Fails if the notes are not sent after the invoices, referencing the first invoice's CUFE."""
    factory, session = client_with(receipt(), Reply(200, b''))
    run = test_set.start(habilitation_issuer, invoices=2, client_factory=factory)
    codes = [entry['code'] for entry in run.entries]
    factory, session = client_with(zip_status([(code, True, []) for code in codes]), receipt('zip-notas'))

    run = test_set.check(run, client_factory=factory)

    notes = sent_files(session.requests[1])
    assert sorted(name[:2] for name in notes) == ['nc', 'nd']
    for root in notes.values():
        assert root.findtext('cac:BillingReference/cac:InvoiceDocumentReference/cbc:UUID', namespaces=NS) == codes[0]
    assert run.state == TestSetRun.State.PROCESSING


@pytest.mark.django_db
def test_set_is_accepted_when_every_document_is(habilitation_issuer):
    """Fails if a set whose invoices and notes were all accepted is not reported as accepted."""
    factory, _session = client_with(receipt())
    run = test_set.start(habilitation_issuer, invoices=1, client_factory=factory)
    factory, _session = client_with(zip_status([(run.entries[0]['code'], True, [])]), receipt('zip-notas'))
    run = test_set.check(run, client_factory=factory)
    notes = [entry['code'] for entry in run.entries if entry['kind'] != 'invoice']
    factory, _session = client_with(zip_status([(code, True, []) for code in notes]))

    run = test_set.check(run, client_factory=factory)

    assert run.state == TestSetRun.State.ACCEPTED
    assert {entry['status'] for entry in run.entries} == {'accepted'}


@pytest.mark.django_db
def test_rejected_document_shows_its_rules(habilitation_issuer):
    """Fails if a rejection in the set loses the DIAN rule the operator must fix."""
    factory, _session = client_with(receipt())
    run = test_set.start(habilitation_issuer, invoices=1, client_factory=factory)
    rule = 'Regla: FAJ43b, Rechazo: Nombre informado No corresponde al registrado en el RUT.'
    factory, _session = client_with(zip_status([(run.entries[0]['code'], False, [rule])]))

    run = test_set.check(run, client_factory=factory)

    assert run.state == TestSetRun.State.REJECTED
    assert run.entries[0]['messages'][0]['rule'] == 'FAJ43b'


@pytest.mark.django_db
def test_numbers_never_repeat_across_runs(habilitation_issuer):
    """Fails if a second run reuses the numbers of the first, which the DIAN rejects (rule 90)."""
    factory, _session = client_with(receipt(), receipt('otro'))

    first = test_set.start(habilitation_issuer, invoices=2, client_factory=factory)
    second = test_set.start(habilitation_issuer, invoices=2, client_factory=factory)

    assert [entry['number'] for entry in first.entries] == [990000000, 990000001]
    assert [entry['number'] for entry in second.entries] == [990000002, 990000003]


@pytest.mark.django_db
def test_failed_upload_is_recorded(habilitation_issuer):
    """Fails if a SOAP fault on upload leaves the run as if it were being processed."""
    fault = b'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault><s:Reason><s:Text>Sin permiso</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>'
    factory, _session = client_with(Reply(400, fault))

    run = test_set.start(habilitation_issuer, invoices=1, client_factory=factory)

    assert run.state == TestSetRun.State.FAILED
    assert 'Sin permiso' in run.error


@pytest.mark.django_db
def test_short_range_fails_without_sending(habilitation_issuer, invoice_range):
    """Fails if a set is sent although the habilitación range cannot hold all its numbers."""
    invoice_range.number_to = invoice_range.number_from + 1
    invoice_range.save()
    factory, session = client_with()

    run = test_set.start(habilitation_issuer, invoices=5, client_factory=factory)

    assert run.state == TestSetRun.State.FAILED
    assert session.requests == []


@pytest.mark.django_db
def test_pending_answers_keep_the_run_open(habilitation_issuer):
    """Fails if a ZIP the DIAN is still processing (no answers yet) closes the run."""
    factory, _session = client_with(receipt())
    run = test_set.start(habilitation_issuer, invoices=1, client_factory=factory)
    factory, _session = client_with(zip_status([]))

    run = test_set.check(run, client_factory=factory)

    assert run.state == TestSetRun.State.PROCESSING
    assert run.entries[0]['status'] == 'pending'

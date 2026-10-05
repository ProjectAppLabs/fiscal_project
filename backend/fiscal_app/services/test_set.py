"""The DIAN test set of an issuer in habilitación (annex FE 1.9 §7.9 SendTestSetAsync and §7.12 GetStatusZip).

The set is sent in two phases. First the invoices; once the DIAN accepts them, a credit note and a debit note that
reference the first invoice, so their BillingReference points to a CUFE the DIAN already knows. The default size is
what the DIAN micrositio shows today (8 invoices, 1 credit note, 1 debit note); the catalog of each TestSetId
decides, so the number of invoices can be raised.

Numbers come from the issuer's habilitación range and never repeat across runs (rule 90).
"""

import copy
import io
import logging
import zipfile
from datetime import datetime

from django.conf import settings
from django.db.models import Max
from django.utils import timezone

from dian import signing, soap
from dian.gateway import DianUnavailable
from dian.ubl.invoice import build_invoice
from dian.ubl.notes import build_note
from fiscal_app.models import (
    Document,
    Issuer,
    NumberingRange,
    SoftwareRegistration,
    TestSetRun,
)
from fiscal_app.models.choices import DocumentKind, Environment, RangeKind
from fiscal_app.services.certificates import active_certificate, credentials_of
from fiscal_app.services.document_validation import validate_document
from fiscal_app.services.gateways import next_file_sequence
from fiscal_app.services.ubl_mapping import (
    document_spec,
    invoice_reference,
    resolution_of,
)

logger = logging.getLogger(__name__)
SET_INVOICES = 8
NOTE_PREFIXES = {DocumentKind.CREDIT_NOTE: 'NC', DocumentKind.DEBIT_NOTE: 'ND'}
NOTE_CONCEPTS = {DocumentKind.CREDIT_NOTE: '2', DocumentKind.DEBIT_NOTE: '4'}
# A restaurant bill (contract v1): two lines with INC 8 %, points redemption and a 10 % tip; payable 45.622.
SAMPLE_BILL = {
    'buyer': {'final_consumer': True},
    'lines': [
        {
            'code': 'HAM-01', 'description': 'Hamburguesa de la casa', 'quantity': '2', 'unit_code': '94',
            'unit_price': '18450.00', 'line_extension': '36900.00',
            'taxes': [{'code': '04', 'rate': '8.00', 'taxable_amount': '36900.00', 'amount': '2952.00'}],
        },
        {
            'code': 'LIM-01', 'description': 'Limonada natural', 'quantity': '1', 'unit_code': '94',
            'unit_price': '6000.00', 'line_extension': '6000.00',
            'taxes': [{'code': '04', 'rate': '8.00', 'taxable_amount': '6000.00', 'amount': '480.00'}],
        },
    ],
    'allowances': [{'reason': 'Canje de puntos', 'amount': '5000.00'}],
    'charges': [{'kind': 'tip', 'reason': 'Propina voluntaria', 'amount': '4290.00'}],
    'totals': {
        'line_extension': '42900.00', 'tax_exclusive': '42900.00', 'tax_inclusive': '46332.00',
        'allowance_total': '5000.00', 'charge_total': '4290.00', 'payable': '45622.00',
    },
    'payment': {'form': '1', 'means': ['10']},
}


class TestSetError(Exception):
    """The issuer is not ready to run the test set; the message says what is missing."""

    __test__ = False


def default_client(credentials, environment):
    return soap.DianClient(credentials, environment, url=settings.DIAN_WS_URLS.get(environment) or None)


def readiness(issuer: Issuer) -> dict:
    """What the issuer has and lacks to run the test set, for the onboarding checklist."""
    software = _software(issuer)
    return {
        'environment': issuer.environment == Environment.TESTING,
        'certificate': active_certificate(issuer) is not None,
        'software': software is not None,
        'test_set_id': bool(software and software.test_set_id),
        'range': _range(issuer) is not None,
    }


def start(issuer: Issuer, invoices: int = SET_INVOICES, client_factory=default_client) -> TestSetRun:
    """Build, sign and send the invoices of the set; the notes follow when the DIAN accepts them."""
    missing = [name for name, ready in readiness(issuer).items() if not ready]
    if missing:
        raise TestSetError(f'Al emisor le falta: {", ".join(MISSING_LABELS[name] for name in missing)}.')
    software, numbering = _software(issuer), _range(issuer)
    credentials = credentials_of(active_certificate(issuer))
    run = TestSetRun.objects.create(issuer=issuer, test_set_id=software.test_set_id)
    first = _next_number(issuer, numbering)
    if first + invoices - 1 > numbering.number_to:
        run.state, run.error = TestSetRun.State.FAILED, 'El rango de habilitación no tiene números suficientes.'
        run.save()
        return run
    now = timezone.now()
    built = []
    for number in range(first, first + invoices):
        document = _document(issuer, DocumentKind.INVOICE, numbering.prefix, number, now, numbering=numbering)
        built.append(_signed(document, software, credentials, invoice_numbering=numbering))
    _send(run, 'invoices', built, credentials, client_factory)
    return run


def check(run: TestSetRun, client_factory=default_client) -> TestSetRun:
    """Ask the DIAN for the result of every ZIP still open; send the notes once the invoices are accepted."""
    if run.state not in (TestSetRun.State.PROCESSING,):
        return run
    issuer = run.issuer
    credentials = credentials_of(active_certificate(issuer))
    client = client_factory(credentials, issuer.environment)
    by_code = {entry['code']: entry for entry in run.entries}
    for phase in run.phases:
        if phase.get('done') or not phase.get('zip_key'):
            continue
        try:
            responses = client.get_status_zip(phase['zip_key'])
        except (soap.DianServiceError, DianUnavailable) as error:
            logger.warning('Set de pruebas %s: GetStatusZip falló: %s', run.pk, error)
            run.error = str(error)[:500]
            run.save(update_fields=['error', 'updated_at'])
            return run
        for response in responses:
            entry = by_code.get(response.document_key)
            if entry is None:
                continue
            entry['status'] = 'accepted' if response.is_valid else 'rejected'
            entry['messages'] = [message.as_dict() for message in response.messages]
        phase['done'] = all(by_code[code]['status'] != 'pending' for code in phase['codes'])
    run.error = ''
    if _phase_accepted(run, 'invoices') and not any(phase['name'] == 'notes' for phase in run.phases):
        _send_notes(run, credentials, client_factory)
    run.state = _state(run)
    run.save()
    return run


def _send_notes(run, credentials, client_factory):
    issuer = run.issuer
    software = _software(issuer)
    invoice_entry = next(entry for entry in run.entries if entry['kind'] == DocumentKind.INVOICE)
    numbering = _range(issuer)
    original = _document(issuer, DocumentKind.INVOICE, numbering.prefix, invoice_entry['number'], timezone.now(),
                         numbering=numbering)
    original.cufe = invoice_entry['code']
    original.issue_datetime = datetime.fromisoformat(invoice_entry['issued_at'])
    built = []
    for kind, prefix in NOTE_PREFIXES.items():
        number = _next_note_number(issuer, prefix)
        note = _document(issuer, kind, prefix, number, timezone.now(), original=original)
        built.append(_signed(note, software, credentials))
    _send(run, 'notes', built, credentials, client_factory)


def _send(run, name, built, credentials, client_factory):
    """ZIP the signed XMLs with the names of §6.5.7, send them with SendTestSetAsync and record the ZipKey."""
    issuer = run.issuer
    year = timezone.localdate().year
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        for item in built:
            xml_name, _zip_name = soap.file_names(item['kind'], issuer.nit, year, next_file_sequence(issuer.pk))
            archive.writestr(xml_name, item.pop('xml'))
            item['file_name'] = xml_name
    _xml_name, zip_name = soap.file_names(DocumentKind.INVOICE, issuer.nit, year, next_file_sequence(issuer.pk))
    run.entries = [*run.entries, *built]
    phase = {'name': name, 'zip_name': zip_name, 'codes': [item['code'] for item in built], 'zip_key': '', 'done': False}
    try:
        receipt = client_factory(credentials, issuer.environment).send_test_set_async(
            zip_name, buffer.getvalue(), run.test_set_id
        )
    except (soap.DianServiceError, DianUnavailable) as error:
        run.phases = [*run.phases, {**phase, 'errors': [str(error)]}]
        run.state, run.error = TestSetRun.State.FAILED, str(error)[:500]
        run.save()
        return
    phase.update(zip_key=receipt.zip_key, errors=receipt.errors)
    run.phases = [*run.phases, phase]
    if not receipt.zip_key:
        run.state, run.error = TestSetRun.State.FAILED, ('; '.join(receipt.errors) or 'La DIAN no entregó ZipKey.')[:500]
    run.save()


def _signed(document, software, credentials, invoice_numbering=None):
    spec = document_spec(document, software)
    if document.kind == DocumentKind.INVOICE:
        built = build_invoice(spec, resolution_of(invoice_numbering))
    else:
        built = build_note(document.kind, spec, invoice_reference(document))
    signing.sign(built.root, credentials, timezone.now())
    return {
        'kind': document.kind, 'number': document.number, 'full_number': document.full_number, 'code': built.code,
        'issued_at': document.issue_datetime.isoformat(), 'status': 'pending', 'messages': [], 'xml': built.tostring(),
    }


def _document(issuer, kind, prefix, number, issued_at, numbering=None, original=None):
    """An unsaved Document: the set documents are built like real ones but never enter the queue."""
    bill = copy.deepcopy(SAMPLE_BILL)
    if original is not None:
        # The note is not a Fiscal. document: the id only satisfies the validation; the reference is `original`.
        bill['billing_reference'] = {'document_id': 1, 'concept_code': NOTE_CONCEPTS[kind]}
    payload, problems = validate_document(kind, bill, issue_date=timezone.localdate(issued_at))
    if problems:
        raise TestSetError(f'El documento de ejemplo no pasa la validación: {problems[0].message}')
    return Document(issuer=issuer, client=issuer.client, kind=kind, prefix=prefix, number=number,
                    issue_datetime=issued_at, payload=payload, numbering_range=numbering, original=original)


def _software(issuer):
    return (
        SoftwareRegistration.objects.filter(issuer=issuer, environment=Environment.TESTING, active=True)
        .order_by('-created_at').first()
    )


def _range(issuer):
    today = timezone.localdate()
    return (
        NumberingRange.objects.filter(issuer=issuer, kind=RangeKind.INVOICE, active=True, valid_from__lte=today,
                                      valid_to__gte=today)
        .order_by('-created_at').first()
    )


def _used_numbers(issuer, prefix):
    used = [entry['number'] for run in issuer.test_set_runs.all() for entry in run.entries
            if entry['full_number'].startswith(prefix) and entry['full_number'][len(prefix):].isdigit()]
    documents = issuer.documents.filter(prefix=prefix).aggregate(last=Max('number'))['last']
    return max([*used, documents or 0])


def _next_number(issuer, numbering):
    return max(numbering.number_from, _used_numbers(issuer, numbering.prefix) + 1)


def _next_note_number(issuer, prefix):
    return _used_numbers(issuer, prefix) + 1


def _phase_accepted(run, name):
    phase = next((phase for phase in run.phases if phase['name'] == name), None)
    if phase is None:
        return False
    by_code = {entry['code']: entry for entry in run.entries}
    return all(by_code[code]['status'] == 'accepted' for code in phase['codes'])


def _state(run):
    statuses = [entry['status'] for entry in run.entries]
    if 'rejected' in statuses:
        return TestSetRun.State.REJECTED
    notes_sent = any(phase['name'] == 'notes' for phase in run.phases)
    if notes_sent and statuses and all(status == 'accepted' for status in statuses):
        return TestSetRun.State.ACCEPTED
    return TestSetRun.State.PROCESSING


MISSING_LABELS = {
    'environment': 'estar en ambiente de habilitación',
    'certificate': 'certificado activo',
    'software': 'software registrado en habilitación',
    'test_set_id': 'TestSetId',
    'range': 'rango de numeración vigente',
}

"""Tests for the UBL 2.1 credit and debit notes built from Fiscal. documents (annex FE 1.9, official XSD)."""

import pytest

from dian.codes import cude
from dian.ubl.common import NS
from dian.ubl.invoice import code_input
from dian.ubl.notes import build_note
from dian.xsd import errors
from fiscal_app.models import SoftwareRegistration
from fiscal_app.services.document_validation import validate_document
from fiscal_app.services.ubl_mapping import document_spec, invoice_reference
from fiscal_app.tests.conftest import restaurant_bill


@pytest.fixture
def make_note(ready_issuer, make_document):
    """Build a validated invoice and a note of `kind` that corrects it; return (note, spec, reference)."""
    invoice = make_document(state='validated', cufe='a' * 96)
    software = SoftwareRegistration.objects.get(issuer=ready_issuer)

    def build(kind):
        bill = restaurant_bill()
        bill['billing_reference'] = {'document_id': invoice.pk, 'concept_code': '2' if kind == 'credit_note' else '4'}
        payload, problems = validate_document(kind, bill)
        assert problems == []
        note = make_document(
            idempotency_key=f'waiter:{kind}', kind=kind, prefix='NC', number=1, payload=payload, original=invoice,
            numbering_range=None,
        )
        spec = document_spec(note, software)
        spec.operation_type = payload['operation_type']
        reference = invoice_reference(note)
        return build_note(kind, spec, reference), spec, reference

    return build


def text(root, path):
    """Text of a UBL path (cbc:/cac: prefixes)."""
    return root.findtext(path, namespaces=NS)


@pytest.mark.django_db
@pytest.mark.parametrize('kind', ['credit_note', 'debit_note'])
def test_note_is_valid_against_the_dian_xsd(make_note, kind):
    """Fails if a credit or debit note Fiscal. builds does not validate against the official schemas."""
    note, _spec, _reference = make_note(kind)

    assert errors(note.root) == []


@pytest.mark.django_db
def test_note_uuid_is_the_cude_with_the_software_pin(make_note):
    """Fails if a note is identified with anything but the CUDE computed with the software PIN (§11.4)."""
    note, spec, _reference = make_note('credit_note')

    assert note.code == cude(code_input(spec), spec.software.pin)
    assert note.root.find('cbc:UUID', NS).get('schemeName') == 'CUDE-SHA384'


@pytest.mark.django_db
def test_credit_note_references_the_invoice_it_cancels(make_note):
    """Fails if the credit note loses the number, CUFE or date of the invoice, or the cancellation concept."""
    note, _spec, reference = make_note('credit_note')

    assert text(note.root, 'cac:BillingReference/cac:InvoiceDocumentReference/cbc:UUID') == reference.cufe
    assert text(note.root, 'cac:DiscrepancyResponse/cbc:ResponseCode') == '2'
    assert text(note.root, 'cac:DiscrepancyResponse/cbc:Description') == 'Anulación de factura electrónica'


@pytest.mark.django_db
def test_credit_note_header_follows_the_annex(make_note):
    """Fails if the credit note profile (CAD03), operation type 20 or note type 91 change."""
    note, _spec, _reference = make_note('credit_note')

    assert text(note.root, 'cbc:ProfileID') == 'DIAN 2.1: Nota Crédito de Factura Electrónica de Venta'
    assert text(note.root, 'cbc:CustomizationID') == '20'
    assert text(note.root, 'cbc:CreditNoteTypeCode') == '91'


@pytest.mark.django_db
def test_debit_note_uses_the_requested_monetary_total(make_note):
    """Fails if the debit note uses LegalMonetaryTotal instead of RequestedMonetaryTotal (UBL DebitNote)."""
    note, _spec, _reference = make_note('debit_note')

    assert note.root.find('cac:RequestedMonetaryTotal', NS) is not None
    assert text(note.root, 'cbc:ProfileID') == 'DIAN 2.1: Nota Débito de Factura Electrónica de Venta'


@pytest.mark.django_db
def test_notes_have_no_numbering_resolution(make_note):
    """Fails if a note carries sts:InvoiceControl: notes are numbered without a DIAN resolution."""
    note, _spec, _reference = make_note('credit_note')

    assert note.root.find('.//sts:InvoiceControl', NS) is None

"""From a Fiscal. document (normalized payload of contract v1) to the DIAN document specification of dian.ubl."""

from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings

from dian.ubl.common import (
    TIP_CODE,
    Address,
    AllowanceCharge,
    DocumentSpec,
    Line,
    Party,
    Payment,
    Resolution,
    Software,
    Tax,
    Totals,
)
from fiscal_app.models import Document, Issuer, NumberingRange, SoftwareRegistration


def _dec(value) -> Decimal:
    return Decimal(str(value or '0'))


def issuer_party(issuer: Issuer) -> Party:
    return Party(
        id_type='31', id_number=issuer.nit, dv=issuer.dv, person_type=issuer.person_type,
        legal_name=issuer.legal_name, trade_name=issuer.trade_name,
        tax_responsibilities=tuple(issuer.tax_responsibilities), tax_scheme=issuer.tax_scheme,
        address=Address(issuer.address_line, issuer.municipality_code, issuer.postal_code),
        email=issuer.email, phone=issuer.phone,
    )


def buyer_party(buyer: dict) -> Party:
    address = buyer.get('address')
    return Party(
        id_type=buyer['id_type'], id_number=buyer['id_number'], dv=buyer.get('dv', ''),
        person_type=buyer['person_type'], legal_name=buyer['name'],
        tax_responsibilities=tuple(buyer.get('tax_responsibilities') or ()), tax_scheme=buyer.get('tax_scheme', 'ZZ'),
        address=Address(address['line'], address['municipality_code']) if address else None,
        email=buyer.get('email', ''), final_consumer=bool(buyer.get('final_consumer')),
    )


def _adjustments(items, *, is_charge, base):
    result = []
    for item in items:
        code = TIP_CODE if is_charge and item.get('kind') == 'tip' else ''
        result.append(AllowanceCharge(is_charge=is_charge, reason=item.get('reason', ''), amount=_dec(item['amount']),
                                      base_amount=base, reason_code=code))
    return result


def _line(line: dict) -> Line:
    base = _dec(line['line_extension'])
    return Line(
        number=line['number'], code=line.get('code', ''), description=line['description'],
        quantity=_dec(line['quantity']), unit_code=line['unit_code'], unit_price=_dec(line['unit_price']),
        line_extension=base,
        taxes=tuple(Tax(t['code'], _dec(t['rate']), _dec(t['taxable_amount']), _dec(t['amount'])) for t in line['taxes']),
        allowances=tuple(_adjustments(line.get('allowances', []), is_charge=False, base=base)),
        charges=tuple(_adjustments(line.get('charges', []), is_charge=True, base=base)),
    )


def document_spec(document: Document, software: SoftwareRegistration) -> DocumentSpec:
    """The DIAN specification of a document: issue date and time in Colombia's legal time (-05:00)."""
    payload = document.payload
    local = document.issue_datetime.astimezone(ZoneInfo(settings.BUSINESS_TIME_ZONE))
    totals = payload['totals']
    line_extension = _dec(totals['line_extension'])
    delivery = payload.get('delivery')
    return DocumentSpec(
        environment=document.issuer.environment, prefix=document.prefix, number=document.number,
        issue_date=local.date().isoformat(), issue_time=local.isoformat(timespec='seconds')[11:],
        issuer=issuer_party(document.issuer), buyer=buyer_party(payload['buyer']),
        software=Software(software.software_id, software.software_pin),
        lines=[_line(line) for line in payload['lines']],
        totals=Totals(
            line_extension=line_extension, tax_exclusive=_dec(totals['tax_exclusive']),
            tax_inclusive=_dec(totals['tax_inclusive']), allowance_total=_dec(totals.get('allowance_total')),
            charge_total=_dec(totals.get('charge_total')), rounding=_dec(totals.get('rounding')),
            payable=_dec(totals['payable']),
        ),
        payment=Payment(payload['payment']['form'], tuple(payload['payment']['means']), payload['payment'].get('due_date') or ''),
        allowances=_adjustments(payload.get('allowances', []), is_charge=False, base=line_extension),
        charges=_adjustments(payload.get('charges', []), is_charge=True, base=line_extension),
        notes=list(payload.get('notes', [])),
        delivery_address=Address(delivery['line'], delivery['municipality_code']) if delivery else None,
        operation_type=payload.get('operation_type', '10'),
        currency=payload.get('currency', 'COP'),
    )


def resolution_of(numbering_range: NumberingRange) -> Resolution:
    return Resolution(
        number=numbering_range.resolution_number, valid_from=numbering_range.valid_from.isoformat(),
        valid_to=numbering_range.valid_to.isoformat(), prefix=numbering_range.prefix,
        number_from=numbering_range.number_from, number_to=numbering_range.number_to,
        technical_key=numbering_range.technical_key,
    )


def invoice_reference(note: Document):
    """BillingReference and DiscrepancyResponse of a note: the original invoice and the correction concept."""
    from dian.catalogs import code_list
    from dian.ubl.notes import InvoiceReference

    original = note.original
    reference = note.payload['billing_reference']
    concepts = code_list('ConceptoNotaCredito' if note.kind == 'credit_note' else 'ConceptoNotaDebito')
    issued = original.issue_datetime.astimezone(ZoneInfo(settings.BUSINESS_TIME_ZONE))
    return InvoiceReference(
        number=original.full_number, cufe=original.cufe, issue_date=issued.date().isoformat(),
        concept_code=reference['concept_code'],
        concept_description=reference.get('reason') or concepts.get(reference['concept_code'], ''),
    )

"""UBL 2.1 CreditNote and DebitNote of the DIAN (annex FE 1.9), unsigned, referencing an invoice.

* ProfileID literals (CAD03 / DAD03), CustomizationID from TipoOperacionNC/ND (20 / 30: references an invoice).
* CUDE with the software PIN (§11.4); notes have no numbering resolution, so no sts:InvoiceControl.
* DiscrepancyResponse carries the correction concept and BillingReference the invoice number, CUFE and date.
* Element order of the official XSD: the debit note puts AllowanceCharge before Delivery and PaymentMeans and uses
  RequestedMonetaryTotal; note lines put TaxTotal before AllowanceCharge.
"""

from dataclasses import dataclass

from lxml import etree

from dian import codes

from .common import (
    NS,
    DocumentSpec,
    address_block,
    allowance_charge_block,
    amount,
    dian_extensions,
    party_block,
    qname,
    sub,
    tax_total_blocks,
)
from .invoice import code_input, payment_means

PROFILES = {
    'credit_note': 'DIAN 2.1: Nota Crédito de Factura Electrónica de Venta',
    'debit_note': 'DIAN 2.1: Nota Débito de Factura Electrónica de Venta',
}
ROOTS = {'credit_note': ('cn', 'CreditNote'), 'debit_note': ('dn', 'DebitNote')}
LINES = {'credit_note': ('CreditNoteLine', 'CreditedQuantity'), 'debit_note': ('DebitNoteLine', 'DebitedQuantity')}
# TipoDocumento: 91 credit note (CreditNoteTypeCode); debit notes have no type code element.
CREDIT_NOTE_TYPE = '91'


@dataclass(frozen=True)
class InvoiceReference:
    """The invoice a note corrects (BillingReference) and why (DiscrepancyResponse)."""

    number: str
    cufe: str
    issue_date: str
    concept_code: str
    concept_description: str


@dataclass(frozen=True)
class BuiltNote:
    root: etree._Element
    code: str  # CUDE
    qr_url: str

    def tostring(self) -> bytes:
        return etree.tostring(self.root, xml_declaration=True, encoding='UTF-8', standalone=False)


def build_note(kind: str, spec: DocumentSpec, reference: InvoiceReference) -> BuiltNote:
    """Build the unsigned credit or debit note of `spec`, correcting the referenced invoice."""
    if kind not in PROFILES:
        raise ValueError(f'Tipo de nota no soportado: {kind}')
    code = codes.cude(code_input(spec), spec.software.pin)
    qr = codes.qr_url(code, spec.environment)
    prefix, tag = ROOTS[kind]
    namespaces = {None: NS[prefix], **{k: NS[k] for k in ('cac', 'cbc', 'ext', 'sts', 'ds', 'xades', 'xades141')}}
    root = etree.Element(qname(prefix, tag), nsmap=namespaces)
    dian_extensions(root, spec, qr)
    sub(root, 'cbc:UBLVersionID', 'UBL 2.1')
    sub(root, 'cbc:CustomizationID', spec.operation_type)
    sub(root, 'cbc:ProfileID', PROFILES[kind])
    sub(root, 'cbc:ProfileExecutionID', spec.environment)
    sub(root, 'cbc:ID', spec.full_number)
    sub(root, 'cbc:UUID', code, schemeID=spec.environment, schemeName='CUDE-SHA384')
    sub(root, 'cbc:IssueDate', spec.issue_date)
    sub(root, 'cbc:IssueTime', spec.issue_time)
    if kind == 'credit_note':
        sub(root, 'cbc:CreditNoteTypeCode', CREDIT_NOTE_TYPE)
    for note in spec.notes:
        sub(root, 'cbc:Note', note)
    sub(root, 'cbc:DocumentCurrencyCode', spec.currency, listAgencyID='6',
        listAgencyName='United Nations Economic Commission for Europe', listID='ISO 4217 Alpha')
    sub(root, 'cbc:LineCountNumeric', len(spec.lines))
    discrepancy = sub(root, 'cac:DiscrepancyResponse')
    sub(discrepancy, 'cbc:ReferenceID', reference.number)
    sub(discrepancy, 'cbc:ResponseCode', reference.concept_code)
    sub(discrepancy, 'cbc:Description', reference.concept_description)
    billing = sub(sub(root, 'cac:BillingReference'), 'cac:InvoiceDocumentReference')
    sub(billing, 'cbc:ID', reference.number)
    sub(billing, 'cbc:UUID', reference.cufe, schemeName='CUFE-SHA384')
    sub(billing, 'cbc:IssueDate', reference.issue_date)

    supplier = sub(root, 'cac:AccountingSupplierParty')
    sub(supplier, 'cbc:AdditionalAccountID', spec.issuer.person_type)
    party_block(supplier, spec.issuer, is_issuer=True, prefix=spec.prefix)
    customer = sub(root, 'cac:AccountingCustomerParty')
    sub(customer, 'cbc:AdditionalAccountID', spec.buyer.person_type)
    party_block(customer, spec.buyer, is_issuer=False)
    adjustments = [*spec.allowances, *spec.charges]
    if kind == 'debit_note':
        _allowances(root, adjustments)
    if spec.delivery_address:
        address_block(sub(root, 'cac:Delivery'), 'cac:DeliveryAddress', spec.delivery_address)
    payment_means(root, spec)
    if kind == 'credit_note':
        _allowances(root, adjustments)
    tax_total_blocks(root, spec.taxes)
    _monetary_total(root, spec, 'cac:LegalMonetaryTotal' if kind == 'credit_note' else 'cac:RequestedMonetaryTotal')
    line_tag, quantity_tag = LINES[kind]
    for line in spec.lines:
        _note_line(root, line, spec.currency, line_tag, quantity_tag, free_of_charge=kind == 'credit_note')
    return BuiltNote(root=root, code=code, qr_url=qr)


def _allowances(root, adjustments):
    for index, item in enumerate(adjustments, start=1):
        allowance_charge_block(root, index, item)


def _monetary_total(root, spec, tag):
    totals = spec.totals
    node = sub(root, tag)
    amount(node, 'cbc:LineExtensionAmount', totals.line_extension, spec.currency)
    amount(node, 'cbc:TaxExclusiveAmount', totals.tax_exclusive, spec.currency)
    amount(node, 'cbc:TaxInclusiveAmount', totals.tax_inclusive, spec.currency)
    if totals.allowance_total:
        amount(node, 'cbc:AllowanceTotalAmount', totals.allowance_total, spec.currency)
    if totals.charge_total:
        amount(node, 'cbc:ChargeTotalAmount', totals.charge_total, spec.currency)
    if totals.rounding:
        amount(node, 'cbc:PayableRoundingAmount', totals.rounding, spec.currency)
    amount(node, 'cbc:PayableAmount', totals.payable, spec.currency)


def _note_line(root, line, currency, line_tag, quantity_tag, *, free_of_charge):
    node = sub(root, f'cac:{line_tag}')
    sub(node, 'cbc:ID', line.number)
    sub(node, f'cbc:{quantity_tag}', line.quantity, unitCode=line.unit_code)
    amount(node, 'cbc:LineExtensionAmount', line.line_extension, currency)
    if free_of_charge:
        sub(node, 'cbc:FreeOfChargeIndicator', 'false')
    tax_total_blocks(node, list(line.taxes))
    for index, item in enumerate([*line.allowances, *line.charges], start=1):
        allowance_charge_block(node, index, item)
    item = sub(node, 'cac:Item')
    sub(item, 'cbc:Description', line.description)
    if line.code:
        sub(sub(item, 'cac:StandardItemIdentification'), 'cbc:ID', line.code, schemeID='999')
    price = sub(node, 'cac:Price')
    amount(price, 'cbc:PriceAmount', line.unit_price, currency)
    sub(price, 'cbc:BaseQuantity', line.quantity, unitCode=line.unit_code)

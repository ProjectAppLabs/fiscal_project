"""UBL 2.1 Invoice of the DIAN (annex FE 1.9), unsigned.

The element order follows UBL-Invoice-2.1.xsd and the official examples of the toolkit (`Generica.xml`,
`Consumidor Final.xml`, `Ejemplificacion Propina.xml`). The signature (second ext:UBLExtension, FAC01) is added by
dian.signing.
"""

from dataclasses import dataclass
from decimal import Decimal

from lxml import etree

from dian import codes

from .common import (
    NS,
    TIP_CODE,
    DocumentSpec,
    Resolution,
    address_block,
    allowance_charge_block,
    amount,
    dian_extensions,
    party_block,
    qname,
    sub,
    tax_total_blocks,
)

# InvoiceTypeCode (table 13.1.3): 01 sale; 03 issuer contingency (paper transcription); 04 DIAN contingency.
INVOICE_TYPES = {'01', '03', '04'}
PROFILE = 'DIAN 2.1: Factura Electrónica de Venta'


@dataclass(frozen=True)
class BuiltInvoice:
    root: etree._Element
    code: str  # CUFE (01, 04) or CUDE (03)
    qr_url: str

    def tostring(self) -> bytes:
        return etree.tostring(self.root, xml_declaration=True, encoding='UTF-8', standalone=False)


def code_input(spec: DocumentSpec) -> codes.CodeInput:
    by_code = {'01': Decimal(0), '04': Decimal(0), '03': Decimal(0)}
    for tax in spec.taxes:
        if tax.code in by_code:
            by_code[tax.code] += tax.amount
    return codes.CodeInput(
        number=spec.full_number, issue_date=spec.issue_date, issue_time=spec.issue_time,
        line_extension=spec.totals.line_extension, iva=by_code['01'], inc=by_code['04'], ica=by_code['03'],
        payable=spec.totals.payable, issuer_nit=spec.issuer.id_number, buyer_id=spec.buyer.id_number,
        environment=spec.environment,
    )


def build_invoice(spec: DocumentSpec, resolution: Resolution, invoice_type: str = '01') -> BuiltInvoice:
    """Build the unsigned Invoice. CUFE with the range's technical key; a type-03 transcription uses the CUDE."""
    if invoice_type not in INVOICE_TYPES:
        raise ValueError(f'Tipo de factura no soportado: {invoice_type}')
    data = code_input(spec)
    if invoice_type == '03':
        code, scheme = codes.cude(data, spec.software.pin), 'CUDE-SHA384'
    else:
        code, scheme = codes.cufe(data, resolution.technical_key), 'CUFE-SHA384'
    qr = codes.qr_url(code, spec.environment)

    root = etree.Element(qname('inv', 'Invoice'), nsmap={None: NS['inv'], **{k: NS[k] for k in ('cac', 'cbc', 'ext', 'sts', 'ds', 'xades', 'xades141')}})
    dian_extensions(root, spec, qr, resolution)
    sub(root, 'cbc:UBLVersionID', 'UBL 2.1')
    sub(root, 'cbc:CustomizationID', spec.operation_type)
    sub(root, 'cbc:ProfileID', PROFILE)
    sub(root, 'cbc:ProfileExecutionID', spec.environment)
    sub(root, 'cbc:ID', spec.full_number)
    sub(root, 'cbc:UUID', code, schemeID=spec.environment, schemeName=scheme)
    sub(root, 'cbc:IssueDate', spec.issue_date)
    sub(root, 'cbc:IssueTime', spec.issue_time)
    sub(root, 'cbc:InvoiceTypeCode', invoice_type)
    for note in spec.notes:
        sub(root, 'cbc:Note', note)
    sub(root, 'cbc:DocumentCurrencyCode', spec.currency, listAgencyID='6',
        listAgencyName='United Nations Economic Commission for Europe', listID='ISO 4217 Alpha')
    sub(root, 'cbc:LineCountNumeric', len(spec.lines))
    if invoice_type == '03':
        _paper_invoice_reference(root, spec, code)

    supplier = sub(root, 'cac:AccountingSupplierParty')
    sub(supplier, 'cbc:AdditionalAccountID', spec.issuer.person_type)
    party_block(supplier, spec.issuer, is_issuer=True, prefix=spec.prefix)
    customer = sub(root, 'cac:AccountingCustomerParty')
    sub(customer, 'cbc:AdditionalAccountID', spec.buyer.person_type)
    party_block(customer, spec.buyer, is_issuer=False)
    if spec.delivery_address:
        delivery = sub(root, 'cac:Delivery')
        address_block(delivery, 'cac:DeliveryAddress', spec.delivery_address)
    payment_means(root, spec)
    for index, item in enumerate([*spec.allowances, *spec.charges], start=1):
        allowance_charge_block(root, index, item)
    tax_total_blocks(root, spec.taxes)
    _monetary_total(root, spec)
    for line in spec.lines:
        _invoice_line(root, line, spec.currency)
    return BuiltInvoice(root=root, code=code, qr_url=qr)


def _paper_invoice_reference(root, spec, code):
    """FAI01–FAI05: a type-03 transcription references the paper invoice it copies (same number, its issue date).

    The paper invoice has no CUFE; the annex asks for one (FAI03), so the transcription's own CUDE is informed. To be
    confirmed in habilitación.
    """
    reference = sub(root, 'cac:AdditionalDocumentReference')
    sub(reference, 'cbc:ID', spec.full_number)
    sub(reference, 'cbc:UUID', code, schemeName='CUDE-SHA384')
    sub(reference, 'cbc:IssueDate', spec.issue_date)


def payment_means(root, spec):
    for code in spec.payment.means:
        means = sub(root, 'cac:PaymentMeans')
        sub(means, 'cbc:ID', spec.payment.form)
        sub(means, 'cbc:PaymentMeansCode', code)
        if spec.payment.due_date:
            sub(means, 'cbc:PaymentDueDate', spec.payment.due_date)


def _monetary_total(root, spec):
    totals = spec.totals
    node = sub(root, 'cac:LegalMonetaryTotal')
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


def _invoice_line(root, line, currency):
    node = sub(root, 'cac:InvoiceLine')
    sub(node, 'cbc:ID', line.number)
    sub(node, 'cbc:InvoicedQuantity', line.quantity, unitCode=line.unit_code)
    amount(node, 'cbc:LineExtensionAmount', line.line_extension, currency)
    sub(node, 'cbc:FreeOfChargeIndicator', 'false')
    for index, item in enumerate([*line.allowances, *line.charges], start=1):
        allowance_charge_block(node, index, item)
    tax_total_blocks(node, list(line.taxes))
    item = sub(node, 'cac:Item')
    sub(item, 'cbc:Description', line.description)
    if line.code:
        standard = sub(item, 'cac:StandardItemIdentification')
        # 999: «Estándar de adopción del contribuyente» (table 13.3.5).
        sub(standard, 'cbc:ID', line.code, schemeID='999')
    price = sub(node, 'cac:Price')
    amount(price, 'cbc:PriceAmount', line.unit_price, currency)
    # Newer toolkit examples: BaseQuantity equals the invoiced quantity and PriceAmount is the unit price.
    sub(price, 'cbc:BaseQuantity', line.quantity, unitCode=line.unit_code)


def is_tip(charge) -> bool:
    return charge.reason_code == TIP_CODE

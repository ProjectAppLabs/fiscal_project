"""Graphical representation (PDF) of a signed Invoice, CreditNote or DebitNote.

Everything printed comes from the signed XML, except the software manufacturer, which the FE XML does not carry and
Res. 000227 art. 1.5.1.2.2.1 (num. 18) asks to show. The QR of annex FE 1.9 §11.7 (document data, CUFE/CUDE and lookup
URL) is drawn on every page at 2.5 cm, above the 2 cm minimum.
"""

import io
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from lxml import etree
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from dian.catalogs import code_list
from dian.ubl.common import NS

QR_SIZE = 2.5 * cm
TITLES = {
    'Invoice': 'Factura electrónica de venta',
    'CreditNote': 'Nota crédito electrónica',
    'DebitNote': 'Nota débito electrónica',
}
LINES = {'Invoice': ('InvoiceLine', 'InvoicedQuantity'), 'CreditNote': ('CreditNoteLine', 'CreditedQuantity'),
         'DebitNote': ('DebitNoteLine', 'DebitedQuantity')}
TYPE_NOTES = {
    '03': 'Transcripción de factura de contingencia del facturador (tipo 03).',
    '04': 'Factura expedida en contingencia por inconvenientes tecnológicos de la DIAN (tipo 04), '
          'sin validación previa; se transmitirá a la DIAN dentro del plazo legal.',
}


@dataclass(frozen=True)
class Manufacturer:
    """Software manufacturer and software name of the issuer's DIAN registration (num. 18)."""

    nit: str
    name: str
    software: str


def render_pdf(signed_xml: bytes, manufacturer: Manufacturer, validated_at: datetime | None = None) -> bytes:
    data = _Read(etree.fromstring(signed_xml))
    buffer = io.BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=LETTER, leftMargin=1.6 * cm, rightMargin=1.6 * cm,
                                 topMargin=1.4 * cm + QR_SIZE, bottomMargin=2.2 * cm,
                                 title=f'{data.title} {data.number}', author=data.issuer_name)

    def decorate(canvas, doc):
        _page_decoration(canvas, doc, data, manufacturer)

    document.build(_story(data, validated_at), onFirstPage=decorate, onLaterPages=decorate)
    return buffer.getvalue()


class _Read:
    """The values of the signed XML the representation shows."""

    def __init__(self, root):
        self.root = root
        self.tag = etree.QName(root).localname
        self.title = TITLES[self.tag]
        self.number = self.text('cbc:ID')
        self.type_code = self.text('cbc:InvoiceTypeCode')
        self.issue = f'{self.text("cbc:IssueDate")} {self.text("cbc:IssueTime")}'
        self.code = self.text('cbc:UUID')
        self.code_name = 'CUDE' if 'CUDE' in (root.find('cbc:UUID', NS).get('schemeName') or '') else 'CUFE'
        self.qr_url = self.text('.//sts:QRCode')
        supplier = 'cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme'
        customer = 'cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme'
        self.issuer_name = self.text(f'{supplier}/cbc:RegistrationName')
        self.trade_name = self.text('cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name')
        self.issuer_id = self._identification(supplier)
        self.issuer_responsibilities = self.text(f'{supplier}/cbc:TaxLevelCode')
        self.issuer_address = self._address('cac:AccountingSupplierParty/cac:Party/cac:PhysicalLocation/cac:Address')
        self.buyer_name = self.text(f'{customer}/cbc:RegistrationName')
        self.buyer_id = self._identification(customer)
        self.delivery = self._address('cac:Delivery/cac:DeliveryAddress')
        totals = root.find('cac:LegalMonetaryTotal', NS)
        self.totals = totals if totals is not None else root.find('cac:RequestedMonetaryTotal', NS)

    def text(self, path, node=None) -> str:
        return ((node if node is not None else self.root).findtext(path, namespaces=NS) or '').strip()

    def _identification(self, path):
        company = self.root.find(f'{path}/cbc:CompanyID', NS)
        if company is None:
            return ''
        kind = code_list('TipoIdFiscal').get(company.get('schemeName') or '', '')
        check = f'-{company.get("schemeID")}' if company.get('schemeName') == '31' and company.get('schemeID') else ''
        return f'{kind} {company.text}{check}'.strip()

    def _address(self, path):
        address = self.root.find(path, NS)
        if address is None:
            return ''
        parts = [self.text('cac:AddressLine/cbc:Line', address), self.text('cbc:CityName', address),
                 self.text('cbc:CountrySubentity', address)]
        return ', '.join(part for part in parts if part)


def _story(data, validated_at):
    styles = getSampleStyleSheet()
    small = ParagraphStyle('small', parent=styles['Normal'], fontSize=8, leading=10)
    normal = ParagraphStyle('body', parent=styles['Normal'], fontSize=9, leading=11)
    story = [Paragraph(f'<b>{data.title} {data.number}</b>', styles['Title'])]
    if data.type_code in TYPE_NOTES:
        story.append(Paragraph(f'<b>{TYPE_NOTES[data.type_code]}</b>', normal))
    issuer = [f'<b>{_e(data.issuer_name)}</b>', _e(data.issuer_id)]
    if data.trade_name and data.trade_name != data.issuer_name:
        issuer.insert(1, _e(data.trade_name))
    issuer += [_e(data.issuer_address), f'Responsabilidades fiscales: {_e(data.issuer_responsibilities)}']
    buyer = ['<b>Adquiriente</b>', _e(data.buyer_name), _e(data.buyer_id)]
    if data.delivery:
        buyer.append(f'Entrega: {_e(data.delivery)}')
    story += [Spacer(1, 6), _two_columns(Paragraph('<br/>'.join(issuer), normal), Paragraph('<br/>'.join(buyer), normal))]
    story += [Spacer(1, 6), Paragraph('<br/>'.join(_header_facts(data, validated_at)), small)]
    story += [Spacer(1, 8), _lines_table(data, small), Spacer(1, 8), _totals_table(data, normal)]
    return story


def _header_facts(data, validated_at):
    facts = [f'Fecha y hora de generación: {data.issue}']  # IssueDate and IssueTime with its -05:00
    facts.append(f'Fecha y hora de validación DIAN: {validated_at.isoformat(sep=" ", timespec="seconds")}' if validated_at
                 else 'Validación DIAN: pendiente')
    authorization = data.root.find('.//sts:InvoiceControl', NS)
    if authorization is not None:
        facts.append(
            f'Autorización de numeración DIAN {data.text("sts:InvoiceAuthorization", authorization)}, '
            f'prefijo {data.text("sts:AuthorizedInvoices/sts:Prefix", authorization) or "sin prefijo"}, '
            f'del {data.text("sts:AuthorizedInvoices/sts:From", authorization)} al '
            f'{data.text("sts:AuthorizedInvoices/sts:To", authorization)}, vigente del '
            f'{data.text("sts:AuthorizationPeriod/cbc:StartDate", authorization)} al '
            f'{data.text("sts:AuthorizationPeriod/cbc:EndDate", authorization)}'
        )
    reference = data.root.find('cac:BillingReference/cac:InvoiceDocumentReference', NS)
    if reference is not None:
        facts.append(f'Corrige la factura {data.text("cbc:ID", reference)} del {data.text("cbc:IssueDate", reference)} '
                     f'(CUFE {data.text("cbc:UUID", reference)})')
        facts.append(f'Concepto: {_e(data.text("cac:DiscrepancyResponse/cbc:Description"))}')
    forms, means = code_list('FormasPago'), code_list('MediosPago')
    for payment in data.root.findall('cac:PaymentMeans', NS):
        form = forms.get(data.text('cbc:ID', payment), '')
        mean = means.get(data.text('cbc:PaymentMeansCode', payment), '')
        due = data.text('cbc:PaymentDueDate', payment)
        facts.append(f'Forma de pago: {form}. Medio de pago: {mean}' + (f'. Vence: {due}' if due else ''))
    for note in data.root.findall('cbc:Note', NS):
        facts.append(_e(note.text or ''))
    return facts


def _lines_table(data, style):
    line_tag, quantity_tag = LINES[data.tag]
    units = code_list('UnidadesMedida')
    rows = [['#', 'Descripción', 'Cantidad', 'Unidad', 'Valor unitario', 'Impuesto', 'Valor']]
    for line in data.root.findall(f'cac:{line_tag}', NS):
        quantity = line.find(f'cbc:{quantity_tag}', NS)
        taxes = ', '.join(
            f'{data.text("cac:TaxCategory/cac:TaxScheme/cbc:Name", subtotal)} {_percent(data.text("cac:TaxCategory/cbc:Percent", subtotal))}'
            for subtotal in line.findall('cac:TaxTotal/cac:TaxSubtotal', NS)
        )
        rows.append([
            data.text('cbc:ID', line), Paragraph(_e(data.text('cac:Item/cbc:Description', line)), style),
            _number(quantity.text), units.get(quantity.get('unitCode'), quantity.get('unitCode')),
            _money(data.text('cac:Price/cbc:PriceAmount', line)), taxes or '—', _money(data.text('cbc:LineExtensionAmount', line)),
        ])
    table = Table(rows, colWidths=[0.8 * cm, 6.6 * cm, 1.6 * cm, 1.8 * cm, 2.4 * cm, 2.2 * cm, 2.6 * cm], repeatRows=1)
    table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 8), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eeeeee')),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.grey), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
    ]))
    return table


def _totals_table(data, style):
    rows = [['Subtotal (valor bruto)', _money(data.text('cbc:LineExtensionAmount', data.totals))]]
    for adjustment in data.root.findall('cac:AllowanceCharge', NS):
        is_charge = data.text('cbc:ChargeIndicator', adjustment) == 'true'
        reason = data.text('cbc:AllowanceChargeReason', adjustment) or ('Recargo' if is_charge else 'Descuento')
        sign = '' if is_charge else '-'
        rows.append([reason, sign + _money(data.text('cbc:Amount', adjustment))])
    for subtotal in data.root.findall('cac:TaxTotal/cac:TaxSubtotal', NS):
        name = data.text('cac:TaxCategory/cac:TaxScheme/cbc:Name', subtotal)
        percent = _percent(data.text('cac:TaxCategory/cbc:Percent', subtotal))
        base = _money(data.text('cbc:TaxableAmount', subtotal))
        rows.append([f'{name} {percent} sobre {base}', _money(data.text('cbc:TaxAmount', subtotal))])
    if data.text('cbc:PayableRoundingAmount', data.totals):
        rows.append(['Redondeo', _money(data.text('cbc:PayableRoundingAmount', data.totals))])
    rows.append([Paragraph('<b>Total a pagar</b>', style), Paragraph(f'<b>{_money(data.text("cbc:PayableAmount", data.totals))}</b>', style)])
    table = Table(rows, colWidths=[6 * cm, 3.4 * cm], hAlign='RIGHT')
    table.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 9), ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                               ('LINEABOVE', (0, -1), (-1, -1), 0.5, colors.black)]))
    return table


def _two_columns(left, right):
    table = Table([[left, right]], colWidths=[9 * cm, 9 * cm])
    table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    return table


def _page_decoration(canvas, doc, data, manufacturer):
    """QR, header and the legal footer on every page."""
    width, height = LETTER
    canvas.saveState()
    widget = QrCodeWidget(qr_content(data))
    left, bottom, right, top = widget.getBounds()
    drawing = Drawing(QR_SIZE, QR_SIZE, transform=[QR_SIZE / (right - left), 0, 0, QR_SIZE / (top - bottom), 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, canvas, width - doc.rightMargin - QR_SIZE, height - 0.9 * cm - QR_SIZE)
    canvas.setFont('Helvetica-Bold', 11)
    canvas.drawString(doc.leftMargin, height - 1.5 * cm, data.issuer_name[:70])
    canvas.setFont('Helvetica', 9)
    canvas.drawString(doc.leftMargin, height - 2.0 * cm, data.issuer_id)
    canvas.drawString(doc.leftMargin, height - 2.5 * cm, f'{data.title} {data.number}')
    canvas.setFont('Helvetica', 7)
    canvas.drawString(doc.leftMargin, 1.5 * cm, f'{data.code_name}: {data.code}')
    maker = manufacturer.name + (f', NIT {manufacturer.nit}' if manufacturer.nit else '')
    canvas.drawString(doc.leftMargin, 1.1 * cm, f'Fabricante del software: {maker} · Software: {manufacturer.software} · '
                      'Representación gráfica de un documento electrónico')
    canvas.drawRightString(width - doc.rightMargin, 0.7 * cm, f'Página {doc.page}')
    canvas.restoreState()


def qr_content(data) -> str:
    """The QR text of annex §11.7, read from the XML."""
    supplier = 'cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID'
    customer = 'cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID'
    taxes = {'01': Decimal(0), 'other': Decimal(0)}
    for total in data.root.findall('cac:TaxTotal', NS):
        code = data.text('cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID', total)
        taxes['01' if code == '01' else 'other'] += Decimal(data.text('cbc:TaxAmount', total) or '0')
    return '\n'.join([
        f'NumFac: {data.number}', f'FecFac: {data.text("cbc:IssueDate")}', f'HorFac: {data.text("cbc:IssueTime")}',
        f'NitFac: {data.text(supplier)}', f'DocAdq: {data.text(customer)}',
        f'ValFac: {data.text("cbc:LineExtensionAmount", data.totals)}', f'ValIva: {taxes["01"]:.2f}',
        f'ValOtroIm: {taxes["other"]:.2f}', f'ValTolFac: {data.text("cbc:PayableAmount", data.totals)}',
        f'{data.code_name}: {data.code}', data.qr_url,
    ])


def _money(value: str) -> str:
    if not value:
        return ''
    amount = Decimal(value)
    return '$' + f'{amount:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


def _number(value: str) -> str:
    amount = Decimal(value or '0')
    return f'{amount.normalize():f}'.replace('.', ',')


def _percent(value: str) -> str:
    return f'{_number(value)} %' if value else ''


def _e(text: str) -> str:
    return (text or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

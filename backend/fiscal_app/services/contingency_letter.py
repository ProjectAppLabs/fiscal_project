"""Draft of the letter an issuer sends the DIAN about its own technological failure (annex FE 1.9 §12.1).

The legal representative signs it and the business sends it to contingencia.facturadorvp@dian.gov.co with the subject
«NIT-DV; Nombre de la empresa» and contact details in the body. Fiscal. only prepares the draft; it never sends it.
"""

import io
from dataclasses import dataclass
from datetime import date

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from dian.catalogs import code_list
from fiscal_app.models import Document, Issuer
from fiscal_app.models.choices import DocumentKind
from fiscal_app.services.documents import business_date

DIAN_MAILBOX = 'contingencia.facturadorvp@dian.gov.co'


@dataclass(frozen=True)
class LetterDraft:
    pdf: bytes
    subject: str
    recipient: str
    invoices: int


def paper_invoices(issuer: Issuer, start: date, end: date):
    """Invoices of the issuer's contingency (paper or pad) issued between the two dates, inclusive."""
    documents = issuer.documents.filter(kind=DocumentKind.INVOICE).order_by('issue_datetime', 'number')
    return [
        document for document in documents
        if document.payload.get('issuer_contingency') and start <= business_date(document.issue_datetime) <= end
    ]


def draft_letter(issuer: Issuer, start: date, end: date, today: date) -> LetterDraft:
    invoices = paper_invoices(issuer, start, end)
    styles = getSampleStyleSheet()
    body = ParagraphStyle('body', parent=styles['Normal'], fontSize=10.5, leading=15)
    buffer = io.BytesIO()
    story = [
        Paragraph(f'{code_list("Municipio").get(issuer.municipality_code, "")}, {today.isoformat()}'.lstrip(', '), body),
        Spacer(1, 18),
        Paragraph('Señores<br/>Dirección de Impuestos y Aduanas Nacionales — DIAN<br/>'
                  'Subdirección de Factura Electrónica y Soluciones Operativas<br/>'
                  f'{DIAN_MAILBOX}', body),
        Spacer(1, 14),
        Paragraph(f'<b>Asunto:</b> {subject_of(issuer)}. Declaración de inconveniente tecnológico del facturador '
                  'electrónico (contingencia tipo 03).', body),
        Spacer(1, 14),
        Paragraph(
            f'{_e(issuer.legal_name)}, identificada con NIT {issuer.nit}-{issuer.dv}, declara que entre el '
            f'{start.isoformat()} y el {end.isoformat()} tuvo un inconveniente tecnológico que le impidió generar y '
            'transmitir facturas electrónicas de venta. Durante ese tiempo expidió facturas de talonario o de papel '
            'con la numeración de contingencia autorizada por la DIAN, que se relacionan abajo.', body),
        Spacer(1, 8),
        Paragraph(
            'Superado el inconveniente, esas facturas se transcriben como documentos electrónicos de transmisión '
            '(tipo 03) y se transmiten a la DIAN por el servicio SendBillSync dentro de las 48 horas siguientes, como '
            'lo establece el numeral 12.1 del Anexo Técnico de Factura Electrónica de Venta versión 1.9.', body),
        Spacer(1, 12),
        _invoices_table(invoices),
        Spacer(1, 36),
        Paragraph('_______________________________________<br/>Firma del representante legal<br/>'
                  'Nombre:<br/>Documento de identidad:<br/>Teléfono o celular de contacto:', body),
    ]
    SimpleDocTemplate(buffer, pagesize=LETTER, leftMargin=2.5 * cm, rightMargin=2.5 * cm, topMargin=2.5 * cm,
                      bottomMargin=2.5 * cm, title=subject_of(issuer)).build(story)
    return LetterDraft(pdf=buffer.getvalue(), subject=subject_of(issuer), recipient=DIAN_MAILBOX, invoices=len(invoices))


def subject_of(issuer: Issuer) -> str:
    """§12.1: «Nit de la empresa separado con un guion el digito de verificación; Nombre de la empresa»."""
    return f'{issuer.nit}-{issuer.dv}; {issuer.legal_name}'


def _invoices_table(invoices: list[Document]):
    rows = [['Factura', 'Fecha y hora de expedición', 'Valor total', 'Estado en Fiscal.']]
    for document in invoices:
        rows.append([
            document.full_number, document.issue_datetime.isoformat(sep=' ', timespec='minutes'),
            document.payload.get('totals', {}).get('payable', ''), document.get_state_display(),
        ])
    if len(rows) == 1:
        rows.append(['Sin facturas de contingencia registradas en el período', '', '', ''])
    table = Table(rows, colWidths=[3.4 * cm, 4.6 * cm, 3 * cm, 5 * cm], repeatRows=1)
    table.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 9), ('GRID', (0, 0), (-1, -1), 0.25, '#999999')]))
    return table


def _e(text: str) -> str:
    return (text or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

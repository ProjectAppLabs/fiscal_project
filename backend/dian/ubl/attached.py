"""AttachedDocument of the DIAN (annex FE 1.9 §6.4, AE01–AE55): the container delivered to the buyer.

It carries the signed document (CDATA in Attachment/ExternalReference/Description) and, when the DIAN validated it,
the ApplicationResponse with its ResultOfVerification. A type-04 invoice (DIAN contingency) goes without
ApplicationResponse (§12.2). Sender and receiver are copied from the document itself, so the container only says
what the signed XML says. It is signed afterwards with dian.signing, like any other document.
"""

import copy
from dataclasses import dataclass
from datetime import datetime

from lxml import etree

from .common import NS, qname, sub

AD_NAMESPACE = 'urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2'
VALIDATOR = 'Unidad Especial Dirección de Impuestos y Aduanas Nacionales'
# AE45: the referenced document inside the line is the DIAN's answer.
ANSWER_TYPE = 'ApplicationResponse'
# AE53 example: «02» is the code of a document validated by the DIAN.
VALIDATED_CODE = '02'
TAX_SCHEME_CHILDREN = ('RegistrationName', 'CompanyID', 'TaxLevelCode')


@dataclass(frozen=True)
class BuiltAttached:
    root: etree._Element

    def tostring(self) -> bytes:
        return etree.tostring(self.root, xml_declaration=True, encoding='UTF-8', standalone=False)


def build_attached_document(signed_document: bytes, application_response: bytes | None, issued_at: datetime) -> BuiltAttached:
    """The unsigned container of a signed Invoice, CreditNote or DebitNote; `issued_at` in Colombian time."""
    document = etree.fromstring(signed_document)
    number = document.findtext('cbc:ID', namespaces=NS)
    uuid = document.find('cbc:UUID', NS)
    namespaces = {None: AD_NAMESPACE, **{k: NS[k] for k in ('cac', 'cbc', 'ext', 'ds', 'xades', 'xades141')}}
    root = etree.Element(f'{{{AD_NAMESPACE}}}AttachedDocument', nsmap=namespaces)
    sub(root, 'ext:UBLExtensions')
    sub(root, 'cbc:UBLVersionID', 'UBL 2.1')
    sub(root, 'cbc:CustomizationID', 'Documentos adjuntos')
    sub(root, 'cbc:ProfileID', 'Factura Electrónica de Venta')
    sub(root, 'cbc:ProfileExecutionID', document.findtext('cbc:ProfileExecutionID', namespaces=NS))
    sub(root, 'cbc:ID', number)
    sub(root, 'cbc:IssueDate', issued_at.date().isoformat())
    sub(root, 'cbc:IssueTime', issued_at.isoformat(timespec='seconds')[11:])
    sub(root, 'cbc:DocumentType', 'Contenedor de Factura Electrónica')
    sub(root, 'cbc:ParentDocumentID', number)
    _party(sub(root, 'cac:SenderParty'), document.find('cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme', NS))
    _party(sub(root, 'cac:ReceiverParty'), document.find('cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme', NS))
    _embedded(sub(root, 'cac:Attachment'), signed_document)
    if application_response:
        _answer(root, number, uuid, document.findtext('cbc:IssueDate', namespaces=NS), application_response, issued_at)
    return BuiltAttached(root)


def _party(parent, tax_scheme):
    """PartyTaxScheme of the document: name, identification, responsibilities and tax scheme (AE10–AE32)."""
    target = sub(parent, 'cac:PartyTaxScheme')
    for name in TAX_SCHEME_CHILDREN:
        found = tax_scheme.find(f'cbc:{name}', NS)
        if found is not None:
            target.append(copy.deepcopy(found))
    target.append(copy.deepcopy(tax_scheme.find('cac:TaxScheme', NS)))


def _embedded(attachment, content: bytes):
    reference = sub(attachment, 'cac:ExternalReference')
    sub(reference, 'cbc:MimeCode', 'text/xml')
    sub(reference, 'cbc:EncodingCode', 'UTF-8')
    description = sub(reference, 'cbc:Description')
    description.text = etree.CDATA(content.decode('utf-8'))


def _answer(root, number, uuid, issue_date, application_response: bytes, issued_at: datetime):
    """ParentDocumentLineReference with the DIAN's ApplicationResponse and the result of its validation (AE38–AE55)."""
    answer = etree.fromstring(application_response)
    line = sub(root, 'cac:ParentDocumentLineReference')
    sub(line, 'cbc:LineID', 1)
    reference = sub(line, 'cac:DocumentReference')
    sub(reference, 'cbc:ID', number)
    sub(reference, 'cbc:UUID', uuid.text, schemeName=uuid.get('schemeName'))
    sub(reference, 'cbc:IssueDate', issue_date)
    sub(reference, 'cbc:DocumentType', ANSWER_TYPE)
    _embedded(sub(reference, 'cac:Attachment'), application_response)
    result = sub(reference, 'cac:ResultOfVerification')
    sub(result, 'cbc:ValidatorID', VALIDATOR)
    code = answer.findtext('.//cac:DocumentResponse/cac:Response/cbc:ResponseCode', namespaces=NS)
    sub(result, 'cbc:ValidationResultCode', code or VALIDATED_CODE)
    # The answer's own date and time; the container's when the answer does not carry them.
    sub(result, 'cbc:ValidationDate', answer.findtext('cbc:IssueDate', namespaces=NS) or issued_at.date().isoformat())
    sub(result, 'cbc:ValidationTime', answer.findtext('cbc:IssueTime', namespaces=NS) or issued_at.isoformat(timespec='seconds')[11:])


def is_ubl_document(content: bytes) -> bool:
    """True for a signed Invoice, CreditNote or DebitNote (the simulated gateway produces none)."""
    try:
        root = etree.fromstring(content)
    except etree.XMLSyntaxError:
        return False
    return root.tag in {qname('inv', 'Invoice'), qname('cn', 'CreditNote'), qname('dn', 'DebitNote')}

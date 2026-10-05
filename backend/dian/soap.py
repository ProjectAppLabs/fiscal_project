"""Client of the DIAN web service (annex FE 1.9 §7), without Django.

* SOAP 1.2, document/literal (§7.5–§7.6); the action travels in the Content-Type, as the DIAN web services guide asks
  for own implementations, and in wsa:Action.
* WS-Security 1.0 with the X.509 token profile (§7.5): the issuer's certificate as BinarySecurityToken, a Timestamp
  and an RSA-SHA256 signature over wsa:To with exclusive C14N, the configuration the guide gives for SoapUI.
* One signed UBL per ZIP for SendBillSync; one or all of the test set for SendTestSetAsync (§7.9–§7.10).
* Failures follow §12.4: HTTP 500/503/507/508/403 and connection errors are 'error'; no answer within a minute is
  'delay'. Both raise DianUnavailable so the emission queue retries and, after that, enters contingency.

The web service addresses are not in the annex: the DIAN publishes them in the participants catalog (habilitación or
producción, «Participants, Facturador»). The defaults below are the ones published there and can be overridden.
"""

import base64
import io
import logging
import re
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import requests
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import Encoding
from lxml import etree

from .gateway import DianUnavailable
from .signing import SigningCredentials

logger = logging.getLogger(__name__)

ENDPOINTS = {
    '1': 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc',
    '2': 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
}
ACTION_BASE = 'http://wcf.dian.colombia/IWcfDianCustomerServices/'
SOAP = 'http://www.w3.org/2003/05/soap-envelope'
WCF = 'http://wcf.dian.colombia'
WSA = 'http://www.w3.org/2005/08/addressing'
WSSE = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd'
WSU = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'
DS = 'http://www.w3.org/2000/09/xmldsig#'
EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#'
X509_TOKEN = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3'
BASE64_BINARY = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary'
# §12.4: these answers mean the service failed and the same document is retried.
UNAVAILABLE_STATUSES = {403, 500, 503, 507, 508}
CONNECT_TIMEOUT = 10
# §12.4: without an answer within a minute the call is a delay.
READ_TIMEOUT = 60
TIMESTAMP_LIFETIME = timedelta(seconds=60)
# Code of the «Rechazo» rule when a document was already received (the retry of a sent document).
ALREADY_PROCESSED_RULE = '90'
RULE = re.compile(r'Regla:\s*([A-Za-z0-9]+)\s*[,:]?\s*(?:(Rechazo|Notificaci[oó]n)\s*:)?\s*(.*)', re.DOTALL)


@dataclass(frozen=True)
class DianMessage:
    """One rule the DIAN reports: a rejection or a notification (the document stays valid)."""

    rule: str
    message: str
    rejection: bool

    def as_dict(self) -> dict:
        return {'rule': self.rule, 'message': self.message, 'severity': 'rechazo' if self.rejection else 'notificacion'}


@dataclass(frozen=True)
class DianResponse:
    """The DianResponse of SendBillSync, GetStatus and GetStatusZip (§7.10.3, §7.11.3, §7.12.3)."""

    is_valid: bool
    status_code: str
    status_description: str
    status_message: str
    messages: list[DianMessage] = field(default_factory=list)
    application_response: bytes = b''
    document_key: str = ''
    raw: bytes = b''

    @property
    def already_processed(self) -> bool:
        return any(message.rule == ALREADY_PROCESSED_RULE for message in self.messages)


@dataclass(frozen=True)
class UploadReceipt:
    """Answer of SendTestSetAsync (§7.9.3): the ZipKey to ask GetStatusZip, or the errors of the first checks."""

    zip_key: str
    errors: list[str]
    raw: bytes = b''


@dataclass(frozen=True)
class NumberingRange:
    resolution_number: str
    resolution_date: str
    prefix: str
    number_from: int
    number_to: int
    valid_from: str
    valid_to: str
    technical_key: str


def file_names(kind: str, issuer_nit: str, year: int, sequence: int) -> tuple[str, str]:
    """XML and ZIP names of §6.5.7–§6.5.8: prefix, NIT in 10 digits, 000 (software propio), year and hex sequence."""
    prefixes = {'invoice': 'fv', 'credit_note': 'nc', 'debit_note': 'nd'}
    if not 1 <= sequence <= 0xFFFFFFFF:
        raise ValueError('El consecutivo de archivos debe estar entre 1 y FFFFFFFF.')
    stem = f'{int(issuer_nit):010d}000{year % 100:02d}{sequence:08x}'
    return f'{prefixes[kind]}{stem}.xml', f'z{stem}.zip'


def zip_document(xml_name: str, xml: bytes) -> bytes:
    """The ZIP with one signed UBL, as SendBillSync receives it."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(xml_name, xml)
    return buffer.getvalue()


class DianClient:
    """Calls to the DIAN web service in one environment, signed with the issuer's certificate."""

    def __init__(self, credentials: SigningCredentials, environment: str, url: str | None = None, session=None):
        self.credentials = credentials
        self.url = url or ENDPOINTS[environment]
        self.session = session or requests.Session()

    def send_bill_sync(self, file_name: str, zip_bytes: bytes) -> DianResponse:
        body = self._call('SendBillSync', [('fileName', file_name), ('contentFile', base64.b64encode(zip_bytes).decode())])
        return parse_dian_response(body, 'SendBillSyncResult')

    def send_test_set_async(self, file_name: str, zip_bytes: bytes, test_set_id: str) -> UploadReceipt:
        body = self._call('SendTestSetAsync', [
            ('fileName', file_name), ('contentFile', base64.b64encode(zip_bytes).decode()), ('testSetId', test_set_id),
        ])
        result = _result(body, 'SendTestSetAsyncResult')
        errors = [_text(item, 'processedMessage') for item in _all(result, 'XmlParamsResponseTrackId')]
        return UploadReceipt(zip_key=_text(result, 'ZipKey') or _text(result, 'zipKey'), errors=errors, raw=body)

    def get_status(self, track_id: str) -> DianResponse:
        body = self._call('GetStatus', [('trackId', track_id)])
        return parse_dian_response(body, 'GetStatusResult')

    def get_status_zip(self, track_id: str) -> list[DianResponse]:
        body = self._call('GetStatusZip', [('trackId', track_id)])
        result = _result(body, 'GetStatusZipResult')
        return [_dian_response(node, body) for node in _all(result, 'DianResponse')]

    def get_numbering_range(self, issuer_nit: str, software_owner_nit: str, software_id: str) -> list[NumberingRange]:
        """Numbering ranges of the issuer (§7.15); only answers in production, habilitación generates its own."""
        body = self._call('GetNumberingRange', [
            ('accountCode', issuer_nit), ('accountCodeT', software_owner_nit), ('softwareCode', software_id),
        ])
        result = _result(body, 'GetNumberingRangeResult')
        code = _text(result, 'OperationCode')
        if code != '100':
            raise DianServiceError(f'La DIAN no entregó los rangos ({code}): {_text(result, "OperationDescription")}')
        return [
            NumberingRange(
                resolution_number=_text(node, 'ResolutionNumber'), resolution_date=_text(node, 'ResolutionDate'),
                prefix=_text(node, 'Prefix'), number_from=int(_text(node, 'FromNumber')),
                number_to=int(_text(node, 'ToNumber')), valid_from=_text(node, 'ValidDateFrom'),
                valid_to=_text(node, 'ValidDateTo'), technical_key=_text(node, 'TechnicalKey'),
            )
            for node in _all(result, 'NumberRangeResponse')
        ]

    def _call(self, operation: str, parameters: list[tuple[str, str]]) -> bytes:
        action = ACTION_BASE + operation
        envelope = build_envelope(self.credentials, self.url, action, operation, parameters)
        headers = {'Content-Type': f'application/soap+xml;charset=UTF-8;action="{action}"'}
        try:
            response = self.session.post(self.url, data=envelope, headers=headers, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))
        except requests.Timeout as exc:
            raise DianUnavailable(f'La DIAN no respondió {operation} en {READ_TIMEOUT} s.', kind='delay') from exc
        except requests.RequestException as exc:
            raise DianUnavailable(f'No hubo conexión con la DIAN para {operation}: {type(exc).__name__}.') from exc
        if response.status_code in UNAVAILABLE_STATUSES:
            raise DianUnavailable(f'La DIAN respondió HTTP {response.status_code} a {operation}.')
        if response.status_code != 200:
            # A SOAP fault (bad signature, malformed request) is a defect of Fiscal., not of the DIAN service.
            logger.error('La DIAN respondió HTTP %s a %s: %s', response.status_code, operation, _fault(response.content))
            raise DianServiceError(f'La DIAN respondió HTTP {response.status_code} a {operation}: {_fault(response.content)}')
        return response.content


class DianServiceError(Exception):
    """The DIAN answered, but with a fault or an unexpected body: retrying the same request will not help."""


def build_envelope(credentials: SigningCredentials, url: str, action: str, operation: str,
                   parameters: list[tuple[str, str]], now: datetime | None = None) -> bytes:
    """SOAP 1.2 request with the WS-Security header signed over wsa:To."""
    now = now or datetime.now(UTC)
    nsmap = {'soap': SOAP, 'wcf': WCF}
    envelope = etree.Element(f'{{{SOAP}}}Envelope', nsmap=nsmap)
    header = etree.SubElement(envelope, f'{{{SOAP}}}Header', nsmap={'wsa': WSA})
    security = etree.SubElement(header, f'{{{WSSE}}}Security', nsmap={'wsse': WSSE, 'wsu': WSU})
    security.set(f'{{{SOAP}}}mustUnderstand', 'true')
    timestamp = etree.SubElement(security, f'{{{WSU}}}Timestamp', {f'{{{WSU}}}Id': f'TS-{uuid.uuid4().hex}'})
    etree.SubElement(timestamp, f'{{{WSU}}}Created').text = _utc(now)
    etree.SubElement(timestamp, f'{{{WSU}}}Expires').text = _utc(now + TIMESTAMP_LIFETIME)
    token_id = f'X509-{uuid.uuid4().hex}'
    token = etree.SubElement(security, f'{{{WSSE}}}BinarySecurityToken', {
        'EncodingType': BASE64_BINARY, 'ValueType': X509_TOKEN, f'{{{WSU}}}Id': token_id,
    })
    token.text = base64.b64encode(credentials.certificate.public_bytes(Encoding.DER)).decode()
    etree.SubElement(header, f'{{{WSA}}}Action').text = action
    to = etree.SubElement(header, f'{{{WSA}}}To', {f'{{{WSU}}}Id': f'id-{uuid.uuid4().hex}'}, nsmap={'wsu': WSU})
    to.text = url
    body = etree.SubElement(envelope, f'{{{SOAP}}}Body')
    call = etree.SubElement(body, f'{{{WCF}}}{operation}')
    for name, value in parameters:
        etree.SubElement(call, f'{{{WCF}}}{name}').text = value
    # Sign the parsed form: lxml's in-memory exclusive C14N does not see the InclusiveNamespaces prefixes declared on
    # the root, while the DIAN canonicalizes the received document, where it does.
    envelope = etree.fromstring(etree.tostring(envelope))
    security = envelope.find(f'{{{SOAP}}}Header/{{{WSSE}}}Security')
    to = envelope.find(f'{{{SOAP}}}Header/{{{WSA}}}To')
    _sign_header(security, to, token_id, credentials)
    return etree.tostring(envelope, xml_declaration=True, encoding='UTF-8')


def _sign_header(security, to, token_id, credentials):
    signature = etree.SubElement(security, f'{{{DS}}}Signature', {'Id': f'SIG-{uuid.uuid4().hex}'}, nsmap={'ds': DS})
    signed_info = etree.SubElement(signature, f'{{{DS}}}SignedInfo')
    method = etree.SubElement(signed_info, f'{{{DS}}}CanonicalizationMethod', Algorithm=EXC_C14N)
    _inclusive_namespaces(method, 'wsa soap wcf')
    etree.SubElement(signed_info, f'{{{DS}}}SignatureMethod', Algorithm='http://www.w3.org/2001/04/xmldsig-more#rsa-sha256')
    reference = etree.SubElement(signed_info, f'{{{DS}}}Reference', URI=f'#{to.get(f"{{{WSU}}}Id")}')
    transform = etree.SubElement(etree.SubElement(reference, f'{{{DS}}}Transforms'), f'{{{DS}}}Transform', Algorithm=EXC_C14N)
    _inclusive_namespaces(transform, 'soap wcf')
    etree.SubElement(reference, f'{{{DS}}}DigestMethod', Algorithm='http://www.w3.org/2001/04/xmlenc#sha256')
    digest = hashes.Hash(hashes.SHA256())
    digest.update(_exclusive_c14n(to, ['soap', 'wcf']))
    etree.SubElement(reference, f'{{{DS}}}DigestValue').text = base64.b64encode(digest.finalize()).decode()
    value = credentials.private_key.sign(_exclusive_c14n(signed_info, ['wsa', 'soap', 'wcf']), padding.PKCS1v15(), hashes.SHA256())
    etree.SubElement(signature, f'{{{DS}}}SignatureValue').text = base64.b64encode(value).decode()
    key_info = etree.SubElement(signature, f'{{{DS}}}KeyInfo', {'Id': f'KI-{uuid.uuid4().hex}'})
    token_reference = etree.SubElement(key_info, f'{{{WSSE}}}SecurityTokenReference', {f'{{{WSU}}}Id': f'STR-{uuid.uuid4().hex}'})
    etree.SubElement(token_reference, f'{{{WSSE}}}Reference', URI=f'#{token_id}', ValueType=X509_TOKEN)


def _inclusive_namespaces(parent, prefixes):
    etree.SubElement(parent, f'{{{EXC_C14N}}}InclusiveNamespaces', PrefixList=prefixes, nsmap={'ec': EXC_C14N})


def _exclusive_c14n(element, prefixes) -> bytes:
    return etree.tostring(element, method='c14n', exclusive=True, inclusive_ns_prefixes=prefixes)


def _utc(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def parse_dian_response(body: bytes, result_tag: str) -> DianResponse:
    return _dian_response(_result(body, result_tag), body)


def _dian_response(node, body) -> DianResponse:
    xml_base64 = _text(node, 'XmlBase64Bytes')
    try:
        application_response = base64.b64decode(xml_base64) if xml_base64 else b''
    except ValueError:
        application_response = b''
    return DianResponse(
        is_valid=_text(node, 'IsValid').lower() == 'true',
        status_code=_text(node, 'StatusCode'),
        status_description=_text(node, 'StatusDescription'),
        status_message=_text(node, 'StatusMessage'),
        messages=[_message(text) for text in _strings(node, 'ErrorMessage')],
        application_response=application_response,
        document_key=_text(node, 'XmlDocumentKey') or _text(node, 'xmlDocumentKey'),
        raw=body,
    )


def _message(text: str) -> DianMessage:
    match = RULE.match(text.strip())
    if not match:
        return DianMessage(rule='', message=text.strip(), rejection=True)
    rule, severity, message = match.groups()
    return DianMessage(rule=rule, message=message.strip(), rejection=not (severity or '').lower().startswith('notific'))


def _result(body: bytes, tag: str):
    try:
        root = etree.fromstring(body)
    except etree.XMLSyntaxError as exc:
        raise DianServiceError('La respuesta de la DIAN no es XML.') from exc
    found = root.xpath('//*[local-name()=$tag]', tag=tag)
    if not found:
        raise DianServiceError(f'La respuesta de la DIAN no trae {tag}.')
    return found[0]


def _all(node, tag):
    return node.xpath('.//*[local-name()=$tag]', tag=tag)


def _text(node, tag) -> str:
    found = node.xpath('./*[local-name()=$tag]', tag=tag)
    return (found[0].text or '').strip() if found else ''


def _strings(node, tag) -> list[str]:
    containers = node.xpath('./*[local-name()=$tag]', tag=tag)
    if not containers:
        return []
    return [(item.text or '').strip() for item in containers[0] if (item.text or '').strip()]


def _fault(content: bytes) -> str:
    try:
        reasons = etree.fromstring(content).xpath('//*[local-name()="Text" or local-name()="faultstring"]/text()')
    except etree.XMLSyntaxError:
        return content[:200].decode(errors='replace')
    return '; '.join(reason.strip() for reason in reasons)[:500] or 'sin detalle'

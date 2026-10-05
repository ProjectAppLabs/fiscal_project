"""Tests for the DIAN web service client: WS-Security envelope, ZIP names and answers shaped as in annex FE 1.9 §7."""

import base64
import hashlib
from datetime import UTC, datetime

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from lxml import etree
from requests import ConnectionError as ConnectionLost
from requests import ReadTimeout

from dian import soap
from dian.gateway import DianUnavailable
from dian.signing import load_pkcs12
from fiscal_app.services.self_signed import self_signed_p12
from fiscal_app.tests.dian_answers import FakeSession, Reply, answer, dian_response

NOW = datetime(2026, 10, 4, 18, 0, tzinfo=UTC)
NAMESPACES = {'soap': soap.SOAP, 'wsa': soap.WSA, 'wsse': soap.WSSE, 'wsu': soap.WSU, 'ds': soap.DS, 'wcf': soap.WCF}


@pytest.fixture(scope='module')
def credentials():
    return load_pkcs12(base64.b64decode(self_signed_p12('Restaurante de Prueba SAS', 'clave')), 'clave')


def client(credentials, *replies):
    session = FakeSession(*replies)
    return soap.DianClient(credentials, '2', session=session), session


def test_file_names_follow_the_annex_nomenclature():
    """Fails if the XML or ZIP name drifts from §6.5.7–§6.5.8 (prefix, 10-digit NIT, 000, year, 8 hex digits)."""
    assert soap.file_names('debit_note', '800197268', 2019, 3) == (
        'nd08001972680001900000003.xml', 'z08001972680001900000003.zip',
    )
    # The consecutive is hexadecimal, as the annex text says (its «décima primera» example shows 11 in decimal).
    assert soap.file_names('invoice', '800197268', 2026, 11)[0] == 'fv0800197268000260000000b.xml'


def test_zip_carries_exactly_one_document():
    """Fails if the ZIP for SendBillSync holds anything but the single signed XML (§7.10: one UBL per ZIP)."""
    import io
    import zipfile

    data = soap.zip_document('fv1.xml', b'<Invoice/>')

    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        assert archive.namelist() == ['fv1.xml']
        assert archive.read('fv1.xml') == b'<Invoice/>'


def test_envelope_signs_wsa_to_with_the_issuer_certificate(credentials):
    """Fails if the WS-Security signature over wsa:To does not verify with the certificate sent as token."""
    data = soap.build_envelope(credentials, soap.ENDPOINTS['2'], soap.ACTION_BASE + 'GetStatus', 'GetStatus',
                               [('trackId', 'abc')], now=NOW)
    root = etree.fromstring(data)
    to = root.find('soap:Header/wsa:To', NAMESPACES)
    signed_info = root.find('.//ds:SignedInfo', NAMESPACES)
    reference = signed_info.find('ds:Reference', NAMESPACES)

    digest = hashlib.sha256(etree.tostring(to, method='c14n', exclusive=True, inclusive_ns_prefixes=['soap', 'wcf']))
    value = base64.b64decode(root.findtext('.//ds:SignatureValue', namespaces=NAMESPACES))
    canonical = etree.tostring(signed_info, method='c14n', exclusive=True, inclusive_ns_prefixes=['wsa', 'soap', 'wcf'])

    assert reference.get('URI') == '#' + to.get(f'{{{soap.WSU}}}Id')
    assert reference.findtext('ds:DigestValue', namespaces=NAMESPACES) == base64.b64encode(digest.digest()).decode()
    credentials.certificate.public_key().verify(value, canonical, padding.PKCS1v15(), hashes.SHA256())
    assert to.text == soap.ENDPOINTS['2']


def test_envelope_carries_token_timestamp_and_action(credentials):
    """Fails if the header lacks the X.509 token, a one-minute Timestamp or the wsa:Action of the operation."""
    root = etree.fromstring(soap.build_envelope(
        credentials, soap.ENDPOINTS['2'], soap.ACTION_BASE + 'GetStatus', 'GetStatus', [('trackId', 'abc')], now=NOW,
    ))
    token = root.find('.//wsse:BinarySecurityToken', NAMESPACES)
    reference = root.find('.//ds:KeyInfo/wsse:SecurityTokenReference/wsse:Reference', NAMESPACES)

    assert root.findtext('.//wsu:Created', namespaces=NAMESPACES) == '2026-10-04T18:00:00.000Z'
    assert root.findtext('.//wsu:Expires', namespaces=NAMESPACES) == '2026-10-04T18:01:00.000Z'
    assert reference.get('URI') == '#' + token.get(f'{{{soap.WSU}}}Id')
    assert root.findtext('soap:Header/wsa:Action', namespaces=NAMESPACES) == soap.ACTION_BASE + 'GetStatus'
    assert root.findtext('soap:Body/wcf:GetStatus/wcf:trackId', namespaces=NAMESPACES) == 'abc'


def test_action_travels_in_the_content_type(credentials):
    """Fails if the SOAP 1.2 action is missing from the Content-Type, as the DIAN guide requires."""
    dian, session = client(credentials, Reply(200, answer('GetStatus', dian_response('GetStatusResult', valid=True, code='00', rules=[]))))

    dian.get_status('abc')

    content_type = session.requests[0]['headers']['Content-Type']
    assert content_type == f'application/soap+xml;charset=UTF-8;action="{soap.ACTION_BASE}GetStatus"'
    assert session.requests[0]['timeout'] == (soap.CONNECT_TIMEOUT, 60)


def test_accepted_document_keeps_notifications_apart(credentials):
    """Fails if a valid answer loses its ApplicationResponse or treats a notification as a rejection."""
    body = dian_response('SendBillSyncResult', valid=True, code='00', xml=b'<ApplicationResponse>ok</ApplicationResponse>',
                         rules=['Regla: FAJ40, Notificación: El contenido de este elemento no corresponde a un contenido valido'])
    dian, _session = client(credentials, Reply(200, answer('SendBillSync', body)))

    response = dian.send_bill_sync('z1.zip', b'zip')

    assert response.is_valid is True
    assert response.application_response == b'<ApplicationResponse>ok</ApplicationResponse>'
    assert [message.as_dict() for message in response.messages] == [{
        'rule': 'FAJ40', 'severity': 'notificacion',
        'message': 'El contenido de este elemento no corresponde a un contenido valido',
    }]


def test_rejected_document_reports_each_rule(credentials):
    """Fails if a rejection does not list each failed rule with its code, so the restaurant can fix the data."""
    body = dian_response('SendBillSyncResult', valid=False, code='99', rules=[
        'Regla: AA09 Valor del CUFE no está calculado correctamente.',
        'Regla: FAJ43b, Rechazo: Nombre informado No corresponde al registrado en el RUT.',
    ])
    dian, _session = client(credentials, Reply(200, answer('SendBillSync', body)))

    response = dian.send_bill_sync('z1.zip', b'zip')

    assert not response.is_valid
    assert [(message.rule, message.rejection) for message in response.messages] == [('AA09', True), ('FAJ43b', True)]
    assert response.messages[1].message == 'Nombre informado No corresponde al registrado en el RUT.'


def test_already_processed_rule_is_recognized(credentials):
    """Fails if the rule-90 answer to a resent document is not recognized, so its real status is never read."""
    body = dian_response('SendBillSyncResult', valid=False, code='99',
                         rules=['Regla: 90, Rechazo: Documento procesado anteriormente.'])
    dian, _session = client(credentials, Reply(200, answer('SendBillSync', body)))

    assert dian.send_bill_sync('z1.zip', b'zip').already_processed is True


@pytest.mark.parametrize('status', [403, 500, 503, 507, 508])
def test_service_errors_are_retried_as_errors(credentials, status):
    """Fails if an HTTP error the annex lists (§12.4) is not retried as an 'error' of the DIAN service."""
    dian, _session = client(credentials, Reply(status, b''))

    with pytest.raises(DianUnavailable) as error:
        dian.get_status('abc')

    assert error.value.kind == 'error'


def test_timeout_is_a_delay(credentials):
    """Fails if a call without an answer within a minute is not treated as a 'delay' (§12.4)."""
    dian, _session = client(credentials, ReadTimeout())

    with pytest.raises(DianUnavailable) as error:
        dian.get_status('abc')

    assert error.value.kind == 'delay'


def test_connection_failure_is_an_error(credentials):
    """Fails if a failed connection is not retried like an error of the service."""
    dian, _session = client(credentials, ConnectionLost())

    with pytest.raises(DianUnavailable) as error:
        dian.get_status('abc')

    assert error.value.kind == 'error'


def test_soap_fault_is_not_retried_as_unavailable(credentials):
    """Fails if a SOAP fault (a defect of the request) is retried as if the DIAN were down, ending in contingency."""
    fault = b'''<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault><s:Reason>
<s:Text xml:lang="es">El certificado no es valido</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>'''
    dian, _session = client(credentials, Reply(400, fault))

    with pytest.raises(soap.DianServiceError, match='El certificado no es valido'):
        dian.get_status('abc')


def test_test_set_upload_returns_the_zip_key(credentials):
    """Fails if the ZipKey of SendTestSetAsync is lost: without it the test set result cannot be read."""
    result = '''<SendTestSetAsyncResult xmlns:b="http://schemas.datacontract.org/2004/07/UploadDocumentResponse"
 xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><b:ErrorMessageList i:nil="true"/>
<b:ZipKey>358f9538-1f80-4ed5-a3f6-aaa1ef36bebd</b:ZipKey></SendTestSetAsyncResult>'''
    dian, session = client(credentials, Reply(200, answer('SendTestSetAsync', result)))

    receipt = dian.send_test_set_async('z1.zip', b'zip', 'test-set-id')

    assert receipt.zip_key == '358f9538-1f80-4ed5-a3f6-aaa1ef36bebd'
    assert receipt.errors == []
    assert b'<wcf:testSetId>test-set-id</wcf:testSetId>' in session.requests[0]['data']


def test_zip_status_lists_each_document(credentials):
    """Fails if GetStatusZip does not return the answer of every document of the ZIP."""
    inner = dian_response('DianResponse', valid=True, code='00', rules=[])
    result = f'<GetStatusZipResult xmlns:b="http://schemas.datacontract.org/2004/07/DianResponse">{inner}</GetStatusZipResult>'
    dian, _session = client(credentials, Reply(200, answer('GetStatusZip', result)))

    responses = dian.get_status_zip('358f9538')

    assert [(response.is_valid, response.status_code) for response in responses] == [(True, '00')]


def test_numbering_ranges_are_read_with_their_technical_key(credentials):
    """Fails if a numbering range from GetNumberingRange loses a field, above all the technical key of the CUFE."""
    result = '''<GetNumberingRangeResult xmlns:b="http://schemas.datacontract.org/2004/07/NumberRangeResponseList">
<b:OperationCode>100</b:OperationCode><b:OperationDescription>Acción completada OK.</b:OperationDescription>
<b:ResponseList xmlns:c="http://schemas.datacontract.org/2004/07/NumberRangeResponse"><c:NumberRangeResponse>
<c:ResolutionNumber>01234</c:ResolutionNumber><c:ResolutionDate>2016-07-25</c:ResolutionDate><c:Prefix>PRE1</c:Prefix>
<c:FromNumber>10</c:FromNumber><c:ToNumber>20</c:ToNumber><c:ValidDateFrom>2016-07-25</c:ValidDateFrom>
<c:ValidDateTo>2026-07-25</c:ValidDateTo><c:TechnicalKey>clave-tecnica</c:TechnicalKey>
</c:NumberRangeResponse></b:ResponseList></GetNumberingRangeResult>'''
    dian, _session = client(credentials, Reply(200, answer('GetNumberingRange', result)))

    ranges = dian.get_numbering_range('900373115', '900373115', 'sw-1')

    assert ranges == [soap.NumberingRange('01234', '2016-07-25', 'PRE1', 10, 20, '2016-07-25', '2026-07-25', 'clave-tecnica')]

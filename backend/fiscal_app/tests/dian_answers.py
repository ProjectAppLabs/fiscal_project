"""DIAN web service answers shaped as the examples of annex FE 1.9 §7, and a session that replays them."""

import base64

from dian import soap


def answer(operation: str, result: str) -> bytes:
    """A DIAN answer with the envelope of the annex examples around `result`."""
    return f'''<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing">
<s:Header><a:Action s:mustUnderstand="1">{soap.ACTION_BASE}{operation}Response</a:Action></s:Header>
<s:Body><{operation}Response xmlns="http://wcf.dian.colombia">{result}</{operation}Response></s:Body></s:Envelope>'''.encode()


def dian_response(tag: str, *, valid: bool, code: str, rules: list[str], xml: bytes = b'<ApplicationResponse/>') -> str:
    strings = ''.join(f'<c:string>{rule}</c:string>' for rule in rules)
    return f'''<{tag} xmlns:b="http://schemas.datacontract.org/2004/07/DianResponse"
 xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
<b:ErrorMessage xmlns:c="http://schemas.microsoft.com/2003/10/Serialization/Arrays">{strings}</b:ErrorMessage>
<b:IsValid>{'true' if valid else 'false'}</b:IsValid><b:StatusCode>{code}</b:StatusCode>
<b:StatusDescription>{'Procesado Correctamente.' if valid else 'Validación contiene errores en campos mandatorios.'}</b:StatusDescription>
<b:StatusMessage i:nil="true"/><b:XmlBase64Bytes>{base64.b64encode(xml).decode()}</b:XmlBase64Bytes>
<b:XmlBytes i:nil="true"/><b:XmlDocumentKey>{'c' * 96}</b:XmlDocumentKey><b:XmlFileName>fv</b:XmlFileName></{tag}>'''


class Reply:
    def __init__(self, status_code=200, content=b''):
        self.status_code, self.content = status_code, content


class FakeSession:
    """Records the requests and answers with the queued replies (or raises the queued exceptions)."""

    def __init__(self, *replies):
        self.replies, self.requests = list(replies), []

    def post(self, url, data, headers, timeout):
        self.requests.append({'url': url, 'data': data, 'headers': headers, 'timeout': timeout})
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


# The DIAN's validation answer, with the fields the AttachedDocument copies (date, time and ResponseCode 02).
APPLICATION_RESPONSE = b'''<?xml version="1.0" encoding="UTF-8"?>
<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID><cbc:IssueDate>2026-10-04</cbc:IssueDate>
<cbc:IssueTime>13:06:31-05:00</cbc:IssueTime><cac:DocumentResponse><cac:Response><cbc:ResponseCode>02</cbc:ResponseCode>
<cbc:Description>Documento validado por la DIAN</cbc:Description></cac:Response></cac:DocumentResponse>
</ApplicationResponse>'''

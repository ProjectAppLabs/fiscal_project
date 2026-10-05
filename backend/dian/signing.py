"""XAdES-EPES enveloped signature of the DIAN (annex FE 1.9 §10 «Suplemento A: Política de firma» and group DC).

* ds:Signature goes in the second ext:UBLExtension/ext:ExtensionContent (§10.8), after sts:DianExtensions.
* Canonical XML 1.0 without comments (§10.7), RSA-SHA256 over SignedInfo (§10.6) and SHA-256 digests.
* Three references (§10.9): the whole document with the enveloped-signature transform, KeyInfo and SignedProperties.
* SignedProperties: SigningTime in Colombian time (§10.11), SigningCertificate with the whole chain from the signer
  to the root (DC25–DC46), the DIAN policy v2 with the SHA-256 of its PDF (§10.10) and the role «supplier» (§10.12):
  with software «propio o adquirido» the issuer signs with its own certificate.
* Certificates (§10.14, Regla-2): signed with sha256/384/512WithRSAEncryption, key usage with Digital Signature and
  Non Repudiation, valid at the signing time.

The signed document must be serialized once and never reformatted: any whitespace change breaks the first digest.
`verify` checks a signature with the same rules; the tests run it over official signed examples of the toolkit.
"""

import base64
import copy
import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.serialization import Encoding, pkcs12
from lxml import etree

from dian.ubl.common import qname, sub

C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256'
ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
SIGNED_PROPERTIES_TYPE = 'http://uri.etsi.org/01903#SignedProperties'
# §10.10: the policy URL of the annex (the old «/v1/» path of some examples no longer resolves) and the SHA-256 of
# that PDF, the same digest the official examples carry.
POLICY_URL = 'https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf'
POLICY_DIGEST = 'dMoMvtcG5aIzgYo0tIsSQeVJBDnUnfSOfBpxXrmor0Y='
POLICY_DESCRIPTION = 'Política de firma para facturas electrónicas de la República de Colombia.'
SIGNER_ROLE = 'supplier'
COLOMBIA = ZoneInfo('America/Bogota')
ACCEPTED_CERTIFICATE_HASHES = ('sha256', 'sha384', 'sha512')
DIGESTS = {
    SHA256: hashlib.sha256,
    'http://www.w3.org/2001/04/xmldsig-more#sha384': hashlib.sha384,
    'http://www.w3.org/2001/04/xmlenc#sha512': hashlib.sha512,
}
SIGNATURE_HASHES = {
    RSA_SHA256: hashes.SHA256,
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384': hashes.SHA384,
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512': hashes.SHA512,
}


class SigningError(Exception):
    """The certificate cannot sign for the DIAN or a signature does not verify. Messages are for the operator."""


@dataclass(frozen=True)
class SigningCredentials:
    private_key: rsa.RSAPrivateKey
    certificate: x509.Certificate
    chain: tuple[x509.Certificate, ...]  # issuers of the certificate, up to the root


def load_pkcs12(data: bytes, password: str | None) -> SigningCredentials:
    """Credentials from the issuer's .p12/.pfx, checked against the rules of §10.14."""
    try:
        key, certificate, others = pkcs12.load_key_and_certificates(data, password.encode() if password else None)
    except ValueError as exc:
        raise SigningError('No se pudo abrir el certificado: el archivo o la contraseña no son válidos.') from exc
    if key is None or certificate is None:
        raise SigningError('El archivo no trae la llave privada y el certificado del firmante.')
    credentials = SigningCredentials(key, certificate, _ordered_chain(certificate, others or []))
    check_certificate(credentials)
    return credentials


def check_certificate(credentials: SigningCredentials) -> None:
    """Regla-2 of §10.14: RSA key, SHA-2 certificate signature, Digital Signature and Non Repudiation."""
    certificate = credentials.certificate
    if not isinstance(credentials.private_key, rsa.RSAPrivateKey):
        raise SigningError('La llave del certificado debe ser RSA.')
    algorithm = certificate.signature_hash_algorithm
    if algorithm is None or algorithm.name not in ACCEPTED_CERTIFICATE_HASHES:
        raise SigningError('El certificado debe estar firmado con SHA-256, SHA-384 o SHA-512.')
    try:
        usage = certificate.extensions.get_extension_for_class(x509.KeyUsage).value
    except x509.ExtensionNotFound as exc:
        raise SigningError('El certificado no declara el uso de la llave.') from exc
    if not (usage.digital_signature and usage.content_commitment):
        raise SigningError('El certificado debe permitir firma digital y no repudio.')


def _ordered_chain(certificate, others):
    """The issuers of `certificate` in order (intermediate first, root last), from the certificates of the file."""
    by_subject = {other.subject: other for other in others}
    chain, current = [], certificate
    while current.issuer != current.subject and current.issuer in by_subject:
        current = by_subject.pop(current.issuer)
        chain.append(current)
    return tuple(chain)


def sign(root: etree._Element, credentials: SigningCredentials, signing_time: datetime) -> None:
    """Sign the document in place, adding the second ext:UBLExtension with its ds:Signature."""
    certificate = credentials.certificate
    if not certificate.not_valid_before_utc <= signing_time <= certificate.not_valid_after_utc:
        raise SigningError('El certificado no está vigente en la fecha de la firma.')
    extensions = root.find(qname('ext', 'UBLExtensions'))
    if extensions is None:
        raise SigningError('El documento no tiene ext:UBLExtensions.')
    if root.find(f'.//{qname("ds", "Signature")}') is not None:
        raise SigningError('El documento ya está firmado.')

    signature_id = f'xmldsig-{uuid.uuid4()}'
    keyinfo_id = f'xmldsig-{uuid.uuid4()}-keyinfo'
    signedprops_id = f'{signature_id}-signedprops'
    content = sub(sub(extensions, 'ext:UBLExtension'), 'ext:ExtensionContent')
    signature = sub(content, 'ds:Signature', Id=signature_id)
    signed_info = sub(signature, 'ds:SignedInfo')
    sub(signed_info, 'ds:CanonicalizationMethod', Algorithm=C14N)
    sub(signed_info, 'ds:SignatureMethod', Algorithm=RSA_SHA256)
    signature_value = sub(signature, 'ds:SignatureValue', Id=f'{signature_id}-sigvalue')
    key_info = sub(signature, 'ds:KeyInfo', Id=keyinfo_id)
    sub(sub(key_info, 'ds:X509Data'), 'ds:X509Certificate', _b64(certificate.public_bytes(Encoding.DER)))
    qualifying = sub(sub(signature, 'ds:Object'), 'xades:QualifyingProperties', Target=f'#{signature_id}')
    signed_properties = sub(qualifying, 'xades:SignedProperties', Id=signedprops_id)
    _signed_signature_properties(signed_properties, credentials, signing_time)

    _reference(signed_info, _digest(_without_signature(root)), Id=f'{signature_id}-ref0', URI='',
               transforms=[ENVELOPED])
    _reference(signed_info, _digest(_c14n(key_info)), URI=f'#{keyinfo_id}')
    _reference(signed_info, _digest(_c14n(signed_properties)), Type=SIGNED_PROPERTIES_TYPE, URI=f'#{signedprops_id}')
    value = credentials.private_key.sign(_c14n(signed_info), padding.PKCS1v15(), hashes.SHA256())
    signature_value.text = _b64(value)


def _signed_signature_properties(signed_properties, credentials, signing_time):
    properties = sub(signed_properties, 'xades:SignedSignatureProperties')
    sub(properties, 'xades:SigningTime', signing_time.astimezone(COLOMBIA).isoformat(timespec='milliseconds'))
    signing_certificate = sub(properties, 'xades:SigningCertificate')
    for certificate in (credentials.certificate, *credentials.chain):
        cert = sub(signing_certificate, 'xades:Cert')
        cert_digest = sub(cert, 'xades:CertDigest')
        sub(cert_digest, 'ds:DigestMethod', Algorithm=SHA256)
        sub(cert_digest, 'ds:DigestValue', _digest(certificate.public_bytes(Encoding.DER)))
        issuer_serial = sub(cert, 'xades:IssuerSerial')
        sub(issuer_serial, 'ds:X509IssuerName', certificate.issuer.rfc4514_string())
        sub(issuer_serial, 'ds:X509SerialNumber', certificate.serial_number)
    policy = sub(sub(properties, 'xades:SignaturePolicyIdentifier'), 'xades:SignaturePolicyId')
    policy_id = sub(policy, 'xades:SigPolicyId')
    sub(policy_id, 'xades:Identifier', POLICY_URL)
    sub(policy_id, 'xades:Description', POLICY_DESCRIPTION)
    policy_hash = sub(policy, 'xades:SigPolicyHash')
    sub(policy_hash, 'ds:DigestMethod', Algorithm=SHA256)
    sub(policy_hash, 'ds:DigestValue', POLICY_DIGEST)
    sub(sub(sub(properties, 'xades:SignerRole'), 'xades:ClaimedRoles'), 'xades:ClaimedRole', SIGNER_ROLE)


def _reference(signed_info, digest_value, *, transforms=(), **attributes):
    reference = sub(signed_info, 'ds:Reference', **attributes)
    if transforms:
        container = sub(reference, 'ds:Transforms')
        for algorithm in transforms:
            sub(container, 'ds:Transform', Algorithm=algorithm)
    sub(reference, 'ds:DigestMethod', Algorithm=SHA256)
    sub(reference, 'ds:DigestValue', digest_value)


def verify(root: etree._Element) -> x509.Certificate:
    """Check the three references and the SignatureValue; return the signer's certificate.

    Certificate validity and trust are not checked here: the DIAN validates them when it receives the document.
    """
    signature = root.find(f'.//{qname("ds", "Signature")}')
    if signature is None:
        raise SigningError('El documento no está firmado.')
    signed_info = signature.find(qname('ds', 'SignedInfo'))
    for reference in signed_info.findall(qname('ds', 'Reference')):
        uri = reference.get('URI')
        if uri == '':
            data = _without_signature(root)
        else:
            targets = root.xpath('//*[@Id=$id]', id=uri.removeprefix('#'))
            if len(targets) != 1:
                raise SigningError(f'La referencia {uri} no apunta a un único elemento.')
            data = _c14n(targets[0])
        algorithm = reference.find(qname('ds', 'DigestMethod')).get('Algorithm')
        if algorithm not in DIGESTS:
            raise SigningError(f'Algoritmo de resumen no admitido: {algorithm}')
        expected = ''.join(reference.findtext(qname('ds', 'DigestValue')).split())
        if _b64(DIGESTS[algorithm](data).digest()) != expected:
            raise SigningError(f'El resumen de la referencia «{uri}» no coincide: el documento cambió tras firmarse.')
    der = base64.b64decode(''.join(signature.findtext(f'.//{qname("ds", "X509Certificate")}').split()))
    certificate = x509.load_der_x509_certificate(der)
    method = signed_info.find(qname('ds', 'SignatureMethod')).get('Algorithm')
    if method not in SIGNATURE_HASHES:
        raise SigningError(f'Algoritmo de firma no admitido: {method}')
    value = base64.b64decode(''.join(signature.findtext(qname('ds', 'SignatureValue')).split()))
    try:
        certificate.public_key().verify(value, _c14n(signed_info), padding.PKCS1v15(), SIGNATURE_HASHES[method]())
    except InvalidSignature as exc:
        raise SigningError('La firma no corresponde al certificado del documento.') from exc
    return certificate


def _without_signature(root):
    """Canonical form of the document after the enveloped-signature transform."""
    clone = copy.deepcopy(root)
    signature = clone.find(f'.//{qname("ds", "Signature")}')
    parent, tail = signature.getparent(), signature.tail
    previous = signature.getprevious()
    parent.remove(signature)  # lxml drops the tail with the element; the transform removes only the element
    if tail:
        if previous is not None:
            previous.tail = (previous.tail or '') + tail
        else:
            parent.text = (parent.text or '') + tail
    return _c14n(clone)


def _c14n(element) -> bytes:
    """Canonical XML 1.0 without comments (inclusive: in-scope namespaces of the ancestors are rendered)."""
    return etree.tostring(element, method='c14n', exclusive=False, with_comments=False)


def _digest(data: bytes) -> str:
    return _b64(hashlib.sha256(data).digest())


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


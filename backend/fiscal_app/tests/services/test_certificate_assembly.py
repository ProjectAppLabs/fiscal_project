"""Tests for building the .p12 from a certificate and its private key delivered as separate files."""

import base64
import io
import zipfile
from datetime import UTC, datetime, timedelta

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import AuthorityInformationAccessOID, NameOID
from django.core.exceptions import ValidationError

from dian import signing
from fiscal_app.services import certificate_assembly
from fiscal_app.services.self_signed import SIGNING_KEY_USAGE

ROOT_URL = 'http://ca.example/root.crt'
INTERMEDIATE_URL = 'http://ca.example/intermediate.crt'
CA_USAGE = x509.KeyUsage(
    digital_signature=False, content_commitment=False, key_encipherment=False, data_encipherment=False,
    key_agreement=False, key_cert_sign=True, crl_sign=True, encipher_only=False, decipher_only=False,
)


def issue(name, key, issuer_name, issuer_key, usage, issuer_url=None):
    now = datetime.now(UTC)
    builder = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)]))
        .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, issuer_name)]))
        .public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=365))
        .add_extension(usage, critical=True)
    )
    if issuer_url:
        builder = builder.add_extension(x509.AuthorityInformationAccess([
            x509.AccessDescription(AuthorityInformationAccessOID.CA_ISSUERS, x509.UniformResourceIdentifier(issuer_url)),
        ]), critical=False)
    return builder.sign(issuer_key, hashes.SHA256())


@pytest.fixture(scope='module')
def entity():
    """A certification entity (root → intermediate) and an issuer certificate pointing to its intermediate."""
    keys = [rsa.generate_private_key(public_exponent=65537, key_size=2048) for _ in range(3)]
    root = issue('Raíz', keys[0], 'Raíz', keys[0], CA_USAGE)
    intermediate = issue('Intermedia', keys[1], 'Raíz', keys[0], CA_USAGE, ROOT_URL)
    leaf = issue('PEREZ PEREZ GUSTAVO ADOLFO', keys[2], 'Intermedia', keys[1], SIGNING_KEY_USAGE, INTERMEDIATE_URL)
    published = {ROOT_URL: root.public_bytes(serialization.Encoding.DER),
                 INTERMEDIATE_URL: intermediate.public_bytes(serialization.Encoding.DER)}
    return {'key': keys[2], 'leaf': leaf, 'published': published}


def pem(certificate):
    return certificate.public_bytes(serialization.Encoding.PEM)


def key_pem(key, password=None):
    encryption = serialization.BestAvailableEncryption(password.encode()) if password else serialization.NoEncryption()
    return key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, encryption)


def opened(assembled):
    return signing.load_pkcs12(base64.b64decode(assembled.p12_base64), assembled.password)


def test_certificate_and_key_become_a_p12_with_the_whole_chain(entity):
    """Fails if the .p12 built from separate files lacks the intermediate and the root the DIAN signature lists."""
    assembled = certificate_assembly.assemble(pem(entity['leaf']), key_pem(entity['key']), fetch=entity['published'].__getitem__)

    credentials = opened(assembled)
    assert assembled.chain_complete is True
    assert [cert.subject.rfc4514_string() for cert in credentials.chain] == ['CN=Intermedia', 'CN=Raíz']


def test_der_certificate_inside_a_zip_is_accepted(entity):
    """Fails if a .cer delivered inside a .zip (as Thomas Signe does) is not read."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        archive.writestr('7674.cer', entity['leaf'].public_bytes(serialization.Encoding.DER))

    assembled = certificate_assembly.assemble(buffer.getvalue(), key_pem(entity['key']), fetch=entity['published'].__getitem__)

    assert opened(assembled).certificate == entity['leaf']


def test_encrypted_key_opens_with_its_password(entity):
    """Fails if a private key protected with a password cannot be used even when the password is given."""
    assembled = certificate_assembly.assemble(pem(entity['leaf']), key_pem(entity['key'], 'clave-llave'), 'clave-llave',
                                              fetch=entity['published'].__getitem__)

    assert opened(assembled).certificate == entity['leaf']


def test_encrypted_key_without_password_is_explained(entity):
    """Fails if a key that needs a password fails with an unclear error instead of asking for it."""
    with pytest.raises(ValidationError) as error:
        certificate_assembly.assemble(pem(entity['leaf']), key_pem(entity['key'], 'clave-llave'))

    assert error.value.code == 'key_password'


def test_key_of_another_certificate_is_refused(entity):
    """Fails if a private key that does not belong to the certificate is packed with it: nothing would sign."""
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    with pytest.raises(ValidationError) as error:
        certificate_assembly.assemble(pem(entity['leaf']), key_pem(other), fetch=entity['published'].__getitem__)

    assert error.value.code == 'key_mismatch'


def test_unreachable_chain_still_gives_a_usable_p12(entity):
    """Fails if a temporary failure of the entity's site blocks the upload instead of storing the certificate alone."""
    def offline(url):
        raise OSError('sin red')

    assembled = certificate_assembly.assemble(pem(entity['leaf']), key_pem(entity['key']), fetch=offline)

    assert assembled.chain_complete is False
    assert opened(assembled).chain == ()


def test_wrong_issuer_downloaded_is_not_chained(entity):
    """Fails if a certificate downloaded from the chain address is accepted although it did not issue the certificate."""
    stranger = issue('Otra', entity['key'], 'Otra', entity['key'], CA_USAGE)

    assembled = certificate_assembly.assemble(pem(entity['leaf']), key_pem(entity['key']),
                                              fetch=lambda url: stranger.public_bytes(serialization.Encoding.DER))

    assert (assembled.chain_complete, opened(assembled).chain) == (False, ())


@pytest.mark.parametrize('url', ['http://127.0.0.1/root.crt', 'http://10.0.0.5/root.crt', 'file:///etc/passwd', 'ftp://ca.example/x'])
def test_chain_download_refuses_internal_addresses(url):
    """Fails if a crafted certificate can make Fiscal. fetch internal or non-web addresses (SSRF)."""
    with pytest.raises(ValidationError) as error:
        certificate_assembly.download(url)

    assert error.value.code == 'chain_url'

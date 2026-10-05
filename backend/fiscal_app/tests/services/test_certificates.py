"""Tests for loading issuer certificates."""

import base64
from datetime import UTC, datetime, timedelta

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import BestAvailableEncryption, pkcs12
from cryptography.x509.oid import NameOID
from django.core.exceptions import ValidationError
from django.db import connection
from lxml import etree

from dian import signing
from fiscal_app.services.certificates import (
    active_certificate,
    credentials_of,
    set_certificate,
)
from fiscal_app.services.self_signed import self_signed_p12


@pytest.mark.django_db
def test_valid_certificate_becomes_active(issuer):
    """Fails if a valid .p12 is not stored as the issuer's active certificate with its public data."""
    certificate = set_certificate(issuer, self_signed_p12('Restaurante de Prueba SAS', 'clave-1'), 'clave-1')

    assert active_certificate(issuer) == certificate
    assert 'Restaurante de Prueba SAS' in certificate.subject


@pytest.mark.django_db
def test_new_certificate_replaces_the_active_one(issuer):
    """Fails if two certificates stay active and documents could be signed with the old one."""
    set_certificate(issuer, self_signed_p12('Uno', 'clave-1'), 'clave-1')
    second = set_certificate(issuer, self_signed_p12('Dos', 'clave-2'), 'clave-2')

    assert list(issuer.certificates.filter(active=True)) == [second]


@pytest.mark.django_db
def test_wrong_password_is_rejected(issuer):
    """Fails if a certificate that does not open with the given password is stored."""
    with pytest.raises(ValidationError) as error:
        set_certificate(issuer, self_signed_p12('Uno', 'clave-1'), 'otra')
    assert error.value.code == 'invalid_certificate'
    assert not issuer.certificates.exists()


@pytest.mark.django_db
def test_expired_certificate_is_rejected(issuer):
    """Fails if an expired certificate is accepted: the DIAN would reject every signature made with it."""
    with pytest.raises(ValidationError) as error:
        set_certificate(issuer, self_signed_p12('Uno', 'clave-1', days=-1), 'clave-1')
    assert error.value.code == 'certificate_expired'


@pytest.mark.django_db
def test_non_base64_certificate_is_rejected(issuer):
    """Fails if a certificate that is not base64 reaches the parser instead of a clear error."""
    with pytest.raises(ValidationError) as error:
        set_certificate(issuer, 'esto no es base64 !!', 'clave')
    assert error.value.code == 'invalid_certificate'


@pytest.mark.django_db
def test_certificate_and_password_are_stored_encrypted(issuer):
    """Fails if the .p12 or its password can be read from the database."""
    p12 = self_signed_p12('Uno', 'clave-secreta-987')
    set_certificate(issuer, p12, 'clave-secreta-987')
    with connection.cursor() as cursor:
        cursor.execute('SELECT p12, password FROM fiscal_app_certificate')
        stored_p12, stored_password = cursor.fetchone()

    assert p12[:60] not in stored_p12
    assert 'clave-secreta-987' not in stored_password


def p12_without_non_repudiation(password: str) -> str:
    """A base64 .p12 whose certificate only allows Digital Signature."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Sin No Repudio')])
    now = datetime.now(UTC)
    usage = x509.KeyUsage(
        digital_signature=True, content_commitment=False, key_encipherment=False, data_encipherment=False,
        key_agreement=False, key_cert_sign=False, crl_sign=False, encipher_only=False, decipher_only=False,
    )
    certificate = (
        x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=30)).add_extension(usage, critical=True).sign(key, hashes.SHA256())
    )
    raw = pkcs12.serialize_key_and_certificates(b'x', key, certificate, None, BestAvailableEncryption(password.encode()))
    return base64.b64encode(raw).decode()


@pytest.mark.django_db
def test_certificate_without_non_repudiation_is_rejected_on_upload(issuer):
    """Fails if a certificate the DIAN would reject for signing (no Non Repudiation, §10.14) is stored."""
    with pytest.raises(ValidationError) as error:
        set_certificate(issuer, p12_without_non_repudiation('clave'), 'clave')

    assert error.value.code == 'invalid_certificate'
    assert not issuer.certificates.exists()


@pytest.mark.django_db
def test_stored_certificate_gives_credentials_that_sign(issuer):
    """Fails if the stored, encrypted certificate cannot be turned back into credentials that sign and verify."""
    certificate = set_certificate(issuer, self_signed_p12('Uno', 'clave-1'), 'clave-1')
    root = etree.fromstring(
        b'<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" '
        b'xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"><ext:UBLExtensions/></Invoice>'
    )

    signing.sign(root, credentials_of(certificate), certificate.not_before + timedelta(days=1))

    assert signing.verify(etree.fromstring(etree.tostring(root))).subject.rfc4514_string() == 'CN=Uno'

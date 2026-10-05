"""Tests for loading issuer certificates."""

import pytest
from django.core.exceptions import ValidationError
from django.db import connection

from fiscal_app.services.certificates import active_certificate, set_certificate
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

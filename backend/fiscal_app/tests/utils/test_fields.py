"""Tests for the encrypted and exact-match model fields."""

import pytest
from django.db import IntegrityError, connection

from fiscal_app.models import ClientSecret, ClientSystem, Document
from fiscal_app.utils.crypto import DecryptionError, decrypt, encrypt


@pytest.mark.django_db
def test_encrypted_field_is_unreadable_in_the_database(client_system):
    """Fails if a client secret is stored in plain text in the database."""
    client, secret = client_system
    with connection.cursor() as cursor:
        cursor.execute('SELECT secret FROM fiscal_app_clientsecret WHERE client_id = %s', [client.pk])
        stored = cursor.fetchone()[0]

    assert secret not in stored
    assert ClientSecret.objects.get(client=client).secret == secret


def test_decrypt_with_another_key_raises_without_leaking():
    """Fails if a token encrypted under another key decrypts, or if the error message carries the ciphertext."""
    from cryptography.fernet import Fernet

    foreign = Fernet(Fernet.generate_key()).encrypt(b'secreto').decode()

    with pytest.raises(DecryptionError) as error:
        decrypt(foreign)
    assert foreign not in str(error.value)


def test_encrypt_round_trip():
    """Fails if a value does not come back identical after encryption."""
    assert decrypt(encrypt('PIN 12345')) == 'PIN 12345'


@pytest.mark.django_db
def test_key_ids_differing_only_in_case_are_different():
    """Fails if two key ids that only differ in letter case collide."""
    ClientSystem.objects.create(name='A', key_id='fk_ABC')
    ClientSystem.objects.create(name='B', key_id='fk_abc')

    assert ClientSystem.objects.get(key_id='fk_ABC').name == 'A'


@pytest.mark.mysql
@pytest.mark.django_db
def test_mysql_keeps_key_ids_case_sensitive(client_system):
    """Fails if MySQL's case-insensitive default collation lets 'fk_ABC' find or clash with 'fk_abc'."""
    ClientSystem.objects.create(name='A', key_id='fk_ABC')
    ClientSystem.objects.create(name='B', key_id='fk_abc')

    assert ClientSystem.objects.get(key_id='fk_abc').name == 'B'


@pytest.mark.mysql
@pytest.mark.django_db(transaction=True)
def test_mysql_rejects_a_repeated_idempotency_key(make_document):
    """Fails if MySQL accepts two documents with the same idempotency key for one client."""
    make_document()

    with pytest.raises(IntegrityError):
        make_document(number=990_000_002)

    assert Document.objects.count() == 1

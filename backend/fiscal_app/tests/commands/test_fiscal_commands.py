"""Tests for the Fiscal. management commands."""

from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from fiscal_app.models import ClientSystem, Document
from fiscal_app.models.choices import DocumentState
from fiscal_app.services.client_systems import valid_secrets


@pytest.mark.django_db
def test_create_client_system_prints_a_working_secret():
    """Fails if the printed secret is not the one that authenticates the new client system."""
    out = StringIO()

    call_command('create_client_system', 'Waiter', stdout=out)

    secret = next(line.split('=', 1)[1] for line in out.getvalue().splitlines() if line.startswith('FISCAL_SECRET='))
    assert valid_secrets(ClientSystem.objects.get(name='Waiter')) == [secret]


@pytest.mark.django_db
def test_create_client_system_refuses_a_repeated_name(client_system):
    """Fails if two client systems can share a name and be confused by an operator."""
    with pytest.raises(CommandError):
        call_command('create_client_system', 'Waiter', stdout=StringIO())


@pytest.mark.django_db
def test_rotate_client_secret_prints_the_new_secret(client_system):
    """Fails if the rotated secret printed to the operator is not valid."""
    client, _old = client_system
    out = StringIO()

    call_command('rotate_client_secret', client.key_id, stdout=out)

    secret = out.getvalue().splitlines()[0].split('=', 1)[1]
    assert secret in valid_secrets(client)


@pytest.mark.django_db
def test_fiscal_fake_data_covers_every_document_state():
    """Fails if the fake data used by E2E runs lacks a document in some state the console must show."""
    call_command('create_fiscal_fake_data', stdout=StringIO())

    states = set(Document.objects.values_list('state', flat=True))
    assert states == set(DocumentState.values)


@pytest.mark.django_db
def test_delete_fake_data_removes_the_fiscal_fake_data():
    """Fails if deleting fake data leaves fake documents or the fake client system behind."""
    call_command('create_fiscal_fake_data', stdout=StringIO())

    call_command('delete_fake_data', '--confirm', stdout=StringIO())

    assert not Document.objects.exists()
    assert not ClientSystem.objects.exists()

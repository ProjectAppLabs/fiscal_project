"""Tests for client systems and the rotation of their secrets."""

from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from fiscal_app.services.client_systems import rotate_secret, valid_secrets


@pytest.mark.django_db
def test_new_client_system_has_one_valid_secret(client_system):
    """Fails if a new client system cannot authenticate with the secret it was given."""
    client, secret = client_system

    assert valid_secrets(client) == [secret]


@pytest.mark.django_db
def test_rotation_keeps_the_previous_secret_during_grace(client_system):
    """Fails if rotating a secret cuts the client off before it can switch to the new one."""
    client, old = client_system

    new = rotate_secret(client, timedelta(hours=24))

    assert valid_secrets(client) == [new, old]


@pytest.mark.django_db
def test_previous_secret_stops_after_grace(client_system):
    """Fails if a rotated-out secret keeps authenticating after its grace period."""
    client, old = client_system
    new = rotate_secret(client, timedelta(hours=24))

    with freeze_time(timezone.now() + timedelta(hours=25)):
        assert valid_secrets(client) == [new]


@pytest.mark.django_db
def test_second_rotation_retires_the_oldest_secret_at_once(client_system):
    """Fails if more than two secrets are ever valid at the same time."""
    client, first = client_system
    rotate_secret(client)

    rotate_secret(client)

    assert first not in valid_secrets(client)
    assert len(valid_secrets(client)) == 2

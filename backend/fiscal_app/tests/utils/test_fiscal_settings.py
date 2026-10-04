"""Tests for the Fiscal.-specific start-up settings."""

import pytest
from cryptography.fernet import Fernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from fiscal_project.fiscal_settings import require_dian_gateway, require_fernet_key


@pytest.mark.parametrize('value', [None, ''])
def test_missing_encryption_key_stops_start_up(value):
    """Fails if the app can start without FISCAL_ENCRYPTION_KEY (secrets could not be stored or read)."""
    with pytest.raises(ImproperlyConfigured, match='missing'):
        require_fernet_key(value)


def test_invalid_encryption_key_stops_start_up():
    """Fails if a malformed key is accepted and only breaks later, when the first certificate is saved."""
    with pytest.raises(ImproperlyConfigured, match='not a valid Fernet key'):
        require_fernet_key('not-a-key')


def test_valid_encryption_key_is_returned():
    """Fails if a correct Fernet key is rejected."""
    key = Fernet.generate_key().decode()

    assert require_fernet_key(key) == key


def test_unknown_dian_gateway_stops_start_up():
    """Fails if a typo in DIAN_GATEWAY silently falls back to a gateway nobody chose."""
    with pytest.raises(ImproperlyConfigured, match='DIAN_GATEWAY'):
        require_dian_gateway('production')


def test_dian_gateway_defaults_to_simulated():
    """Fails if an unset DIAN_GATEWAY points at the real DIAN instead of the simulator."""
    assert require_dian_gateway(None) == 'simulated'
    assert settings.DIAN_GATEWAY == 'simulated'


def test_business_time_zone_is_colombia():
    """Fails if issue and signing times stop being produced in Colombia's legal time (-05:00), as the DIAN requires."""
    assert settings.BUSINESS_TIME_ZONE == 'America/Bogota'
    assert settings.TIME_ZONE == 'UTC'

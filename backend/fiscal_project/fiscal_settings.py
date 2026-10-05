"""Settings helpers specific to Fiscal. Kept apart so they can be unit tested."""

from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured

DIAN_GATEWAYS = ('simulated', 'soap')

# Deterministic key used ONLY while running the test suite. Never valid outside tests.
TEST_ENCRYPTION_KEY = 'ZmlzY2FsLXRlc3Qta2V5LW5vdC1mb3ItcHJvZC11c2U='


def require_fernet_key(value: str | None) -> str:
    """Return a valid Fernet key or stop the start-up: without it no secret can be read or stored."""
    if not value:
        raise ImproperlyConfigured(
            'FISCAL_ENCRYPTION_KEY is missing. Generate one with '
            '`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.'
        )
    try:
        Fernet(value.encode())
    except (ValueError, TypeError) as exc:
        raise ImproperlyConfigured('FISCAL_ENCRYPTION_KEY is not a valid Fernet key.') from exc
    return value


def require_dian_gateway(value: str | None) -> str:
    """Return the configured DIAN gateway, or stop the start-up if it is unknown."""
    gateway = (value or 'simulated').strip().lower()
    if gateway not in DIAN_GATEWAYS:
        raise ImproperlyConfigured(f'DIAN_GATEWAY must be one of {", ".join(DIAN_GATEWAYS)}.')
    return gateway

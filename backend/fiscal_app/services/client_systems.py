"""Client systems and their HMAC secrets (up to two valid at once, to rotate without downtime)."""

import secrets
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from fiscal_app.models import ClientSecret, ClientSystem

MAX_VALID_SECRETS = 2


def new_secret() -> str:
    return secrets.token_urlsafe(32)


@transaction.atomic
def create_client_system(
    name: str, webhook_url: str = '', domain: str = '', allow_subdomains: bool = False, allowed_ips: list | None = None,
) -> tuple[ClientSystem, str]:
    """Create a client system and return it with its secret in plain text, which is shown only this once."""
    client = ClientSystem.objects.create(
        name=name, key_id='fk_' + secrets.token_hex(12), webhook_url=webhook_url, domain=domain,
        allow_subdomains=allow_subdomains, allowed_ips=allowed_ips or [],
    )
    secret = new_secret()
    ClientSecret.objects.create(client=client, secret=secret)
    return client, secret


def valid_secrets(client: ClientSystem) -> list[str]:
    """Secrets that currently authenticate the client (current one first)."""
    now = timezone.now()
    rows = client.secrets.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).order_by('-created_at')
    return [row.secret for row in rows[:MAX_VALID_SECRETS]]


@transaction.atomic
def rotate_secret(client: ClientSystem, grace: timedelta = timedelta(hours=24)) -> str:
    """Issue a new secret. The previous current one keeps working for `grace`; any older one stops now."""
    now = timezone.now()
    ClientSystem.objects.select_for_update().get(pk=client.pk)
    live = client.secrets.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).order_by('-created_at')
    rows = list(live)
    current, older = (rows[0], rows[1:]) if rows else (None, [])
    for row in older:
        row.expires_at = now
        row.save(update_fields=['expires_at'])
    if current is not None:
        current.expires_at = now + grace
        current.save(update_fields=['expires_at'])
    secret = new_secret()
    ClientSecret.objects.create(client=client, secret=secret)
    return secret


def secrets_overview(client: ClientSystem) -> list[dict]:
    """The secrets that still authenticate the client, newest first, without their value."""
    now = timezone.now()
    rows = client.secrets.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).order_by('-created_at')[:MAX_VALID_SECRETS]
    return [{'id': row.pk, 'created_at': row.created_at, 'expires_at': row.expires_at, 'current': index == 0}
            for index, row in enumerate(rows)]

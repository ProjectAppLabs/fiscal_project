"""Signed notices to client systems when a document changes state, retried until acknowledged."""

import json
import logging
from datetime import timedelta
from urllib.parse import urlsplit

import requests
from django.conf import settings
from django.utils import timezone

from fiscal_app.authentication.signing import signed_headers
from fiscal_app.models import Document, WebhookDelivery
from fiscal_app.services.client_systems import valid_secrets

logger = logging.getLogger(__name__)
# Waits between attempts; the last one repeats until MAX_ATTEMPTS.
RETRY_DELAYS = [30, 60, 300, 900, 3600]
MAX_ATTEMPTS = 30


def notice_payload(document: Document) -> dict:
    from fiscal_app.serializers import DocumentDetailSerializer

    data = DocumentDetailSerializer(document).data
    data.pop('events', None)
    return {'event': 'document.state_changed', 'document': json.loads(json.dumps(data, default=str))}


def enqueue_notice(document: Document) -> WebhookDelivery | None:
    """Record a notice for the document's client system; None when it has no webhook URL."""
    if not document.client.webhook_url:
        return None
    return WebhookDelivery.objects.create(
        client=document.client, document=document, payload=notice_payload(document), next_attempt_at=timezone.now()
    )


def enqueue_alert(alert) -> WebhookDelivery | None:
    """Record an `issuer.alert` notice for the client system of the alert's issuer; None without webhook URL."""
    client = alert.issuer.client
    if not client.webhook_url:
        return None
    payload = {'event': 'issuer.alert', 'alert': {
        'kind': alert.kind, 'severity': alert.severity, 'message': alert.message, 'issuer': alert.issuer.nit,
        'document': alert.document_id, 'created_at': alert.created_at.isoformat(),
    }}
    return WebhookDelivery.objects.create(client=client, document=alert.document, payload=payload, next_attempt_at=timezone.now())


def deliver(delivery: WebhookDelivery) -> bool:
    """POST the notice signed with the client's current secret. True when the client answered 2xx."""
    client = delivery.client
    secrets = valid_secrets(client)
    if not secrets or not client.webhook_url:
        delivery.last_error = 'El sistema cliente no tiene secreto vigente o URL de avisos.'
        delivery.next_attempt_at = None
        delivery.save(update_fields=['last_error', 'next_attempt_at'])
        return False
    body = json.dumps(delivery.payload, separators=(',', ':')).encode()
    url = client.webhook_url
    parts = urlsplit(url)
    path = parts.path + (f'?{parts.query}' if parts.query else '')
    headers = {**signed_headers(client.key_id, secrets[0], 'POST', path, body), 'Content-Type': 'application/json'}
    delivery.attempts += 1
    try:
        response = requests.post(url, data=body, headers=headers, timeout=settings.FISCAL_WEBHOOK_TIMEOUT, allow_redirects=False)
        delivery.last_status = response.status_code
        delivery.last_error = '' if response.ok else f'HTTP {response.status_code}'
        succeeded = 200 <= response.status_code < 300
    except requests.RequestException as error:
        delivery.last_status = None
        delivery.last_error = type(error).__name__
        succeeded = False
    if succeeded:
        delivery.delivered_at = timezone.now()
        delivery.next_attempt_at = None
    elif delivery.attempts >= MAX_ATTEMPTS:
        delivery.next_attempt_at = None
        logger.error('Aviso %s descartado tras %s intentos: %s', delivery.pk, delivery.attempts, delivery.last_error)
    else:
        wait = RETRY_DELAYS[min(delivery.attempts, len(RETRY_DELAYS)) - 1]
        delivery.next_attempt_at = timezone.now() + timedelta(seconds=wait)
    delivery.save(update_fields=['attempts', 'last_status', 'last_error', 'delivered_at', 'next_attempt_at'])
    return succeeded


def pending_deliveries(now=None):
    now = now or timezone.now()
    return WebhookDelivery.objects.filter(delivered_at__isnull=True, next_attempt_at__lte=now).select_related('client')

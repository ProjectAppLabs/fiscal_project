"""Tests for running a client system from the console: integration data, notice URL, secrets and notices."""

from unittest import mock

import pytest
import requests

from fiscal_app.models import ClientSecret, WebhookDelivery
from fiscal_app.services.client_systems import valid_secrets


@pytest.fixture
def waiter(client_system):
    client, _secret = client_system
    client.webhook_url = 'https://waiter.test/internal/fiscal/events'
    client.save(update_fields=['webhook_url'])
    return client


def answer(status_code):
    return mock.Mock(status_code=status_code, ok=200 <= status_code < 300)


@pytest.mark.django_db
def test_detail_shows_the_key_without_the_secret(authenticated_client, client_system):
    """Fails if the integration page leaks a secret, which is only shown when it is created."""
    client, secret = client_system

    response = authenticated_client.get(f'/api/console/client-systems/{client.pk}/')

    assert response.json()['key_id'] == client.key_id
    assert secret not in response.content.decode()


@pytest.mark.django_db
def test_operator_changes_the_notice_url(authenticated_client, waiter):
    """Fails if the notice URL still needs the database to change."""
    response = authenticated_client.patch(f'/api/console/client-systems/{waiter.pk}/', {'webhook_url': 'https://waiter.test/v2/events'}, format='json')

    waiter.refresh_from_db()
    assert (response.status_code, waiter.webhook_url) == (200, 'https://waiter.test/v2/events')


@pytest.mark.django_db
def test_operator_cannot_switch_a_system_off(authenticated_client, waiter):
    """Fails if a non-administrator can cut a client system off the API."""
    response = authenticated_client.patch(f'/api/console/client-systems/{waiter.pk}/', {'active': False}, format='json')

    waiter.refresh_from_db()
    assert (response.status_code, waiter.active) == (403, True)


@pytest.mark.django_db
def test_admin_switches_a_system_off(console_admin_client, waiter):
    """Fails if an administrator cannot deactivate a client system from the console."""
    console_admin_client.patch(f'/api/console/client-systems/{waiter.pk}/', {'active': False}, format='json')

    waiter.refresh_from_db()
    assert waiter.active is False


@pytest.mark.django_db
def test_admin_rotates_the_secret_with_a_grace_period(console_admin_client, client_system):
    """Fails if a rotation from the console does not keep the previous secret working during the grace period."""
    client, old_secret = client_system

    response = console_admin_client.post(f'/api/console/client-systems/{client.pk}/rotate-secret/', {'grace_hours': 12}, format='json')

    assert response.status_code == 201
    assert valid_secrets(client) == [response.json()['secret'], old_secret]


@pytest.mark.django_db
def test_operator_cannot_rotate_the_secret(authenticated_client, client_system):
    """Fails if a non-administrator can issue a new secret."""
    client, _secret = client_system

    response = authenticated_client.post(f'/api/console/client-systems/{client.pk}/rotate-secret/', {}, format='json')

    assert response.status_code == 403
    assert ClientSecret.objects.filter(client=client).count() == 1


@pytest.mark.django_db
def test_ping_reports_how_the_client_answered(authenticated_client, waiter):
    """Fails if the test notice does not say whether the client system acknowledged it."""
    with mock.patch('fiscal_app.services.webhooks.requests.post', return_value=answer(200)) as post:
        response = authenticated_client.post(f'/api/console/client-systems/{waiter.pk}/ping/', {}, format='json')

    assert (response.json()['event'], response.json()['state']) == ('ping', 'delivered')
    assert post.call_args.kwargs['headers']['X-Fiscal-Key'] == waiter.key_id


@pytest.mark.django_db
def test_failed_ping_is_not_retried(authenticated_client, waiter):
    """Fails if a failed test notice stays in the queue and keeps hitting the client system."""
    with mock.patch('fiscal_app.services.webhooks.requests.post', side_effect=requests.ConnectionError):
        response = authenticated_client.post(f'/api/console/client-systems/{waiter.pk}/ping/', {}, format='json')

    assert (response.json()['state'], response.json()['last_error']) == ('failed', 'ConnectionError')


@pytest.mark.django_db
def test_ping_needs_a_notice_url(authenticated_client, client_system):
    """Fails if a test notice is attempted for a client system without a notice URL."""
    client, _secret = client_system

    response = authenticated_client.post(f'/api/console/client-systems/{client.pk}/ping/', {}, format='json')

    assert (response.status_code, response.json()['code']) == (409, 'no_webhook')


@pytest.mark.django_db
def test_deliveries_list_by_state(authenticated_client, waiter):
    """Fails if the notice log cannot show only the failed notices."""
    WebhookDelivery.objects.create(client=waiter, payload={'event': 'issuer.alert', 'alert': {'kind': 'range_low'}}, attempts=30)
    WebhookDelivery.objects.create(client=waiter, payload={'event': 'ping'}, next_attempt_at=None, attempts=1, delivered_at='2026-10-14T12:00:00Z')

    response = authenticated_client.get(f'/api/console/client-systems/{waiter.pk}/deliveries/?state=failed')

    assert [(row['event'], row['alert_kind']) for row in response.json()['results']] == [('issuer.alert', 'range_low')]


@pytest.mark.django_db
def test_failed_notices_go_back_to_the_queue(authenticated_client, waiter):
    """Fails if the notices that used up their attempts cannot be queued again from the console."""
    failed = WebhookDelivery.objects.create(client=waiter, payload={'event': 'issuer.alert', 'alert': {}}, attempts=30)

    response = authenticated_client.post(f'/api/console/client-systems/{waiter.pk}/deliveries/retry-failed/', {}, format='json')

    failed.refresh_from_db()
    assert response.json() == {'requeued': 1}
    assert (failed.attempts, failed.next_attempt_at is not None) == (0, True)


@pytest.mark.django_db
def test_one_notice_is_sent_again(authenticated_client, waiter):
    """Fails if a single notice cannot be resent on demand."""
    delivery = WebhookDelivery.objects.create(client=waiter, payload={'event': 'issuer.alert', 'alert': {}}, attempts=30)

    with mock.patch('fiscal_app.services.webhooks.requests.post', return_value=answer(204)):
        response = authenticated_client.post(f'/api/console/deliveries/{delivery.pk}/retry/', {}, format='json')

    assert response.json()['state'] == 'delivered'

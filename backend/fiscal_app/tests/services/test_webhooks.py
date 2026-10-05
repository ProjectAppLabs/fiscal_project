"""Tests for the signed notices sent to client systems."""

from unittest.mock import patch

import pytest
from requests.exceptions import ConnectTimeout

from fiscal_app.authentication.signing import sign
from fiscal_app.services.webhooks import deliver, enqueue_notice


@pytest.fixture
def subscribed(client_system):
    """Subscribe the client system to notices (URL with a query string, which the signature covers)."""
    client, secret = client_system
    client.webhook_url = 'https://waiter.test/internal/fiscal/events?v=1'
    client.save()
    return client, secret


class FakeResponse:
    """Minimal stand-in for requests.Response."""

    def __init__(self, status_code):
        """Keep the status code."""
        self.status_code = status_code
        self.ok = 200 <= status_code < 400


@pytest.mark.django_db
def test_notice_is_signed_with_the_current_secret(subscribed, make_document):
    """Fails if the client cannot verify a notice with the same HMAC scheme it uses to call Fiscal."""
    client, secret = subscribed
    delivery = enqueue_notice(make_document())
    with patch('fiscal_app.services.webhooks.requests.post', return_value=FakeResponse(200)) as post:
        deliver(delivery)
    headers, body = post.call_args.kwargs['headers'], post.call_args.kwargs['data']

    expected = sign(secret, headers['X-Fiscal-Timestamp'], 'POST', '/internal/fiscal/events?v=1', body)

    assert headers['X-Fiscal-Signature'] == expected


@pytest.mark.django_db
def test_acknowledged_notice_is_marked_delivered(subscribed, make_document):
    """Fails if a notice answered with 2xx keeps being retried."""
    delivery = enqueue_notice(make_document())
    with patch('fiscal_app.services.webhooks.requests.post', return_value=FakeResponse(204)):
        assert deliver(delivery) is True

    delivery.refresh_from_db()
    assert delivery.delivered_at is not None


@pytest.mark.django_db
def test_failed_notice_is_retried_later(subscribed, make_document):
    """Fails if a notice answered with an error is dropped instead of retried."""
    delivery = enqueue_notice(make_document())
    with patch('fiscal_app.services.webhooks.requests.post', return_value=FakeResponse(503)):
        deliver(delivery)

    delivery.refresh_from_db()
    assert delivery.delivered_at is None
    assert delivery.next_attempt_at is not None
    assert delivery.last_status == 503


@pytest.mark.django_db
def test_network_error_is_recorded_without_details(subscribed, make_document):
    """Fails if a network failure breaks the worker or records more than the error type."""
    delivery = enqueue_notice(make_document())
    with patch('fiscal_app.services.webhooks.requests.post', side_effect=ConnectTimeout('x')):
        assert deliver(delivery) is False

    delivery.refresh_from_db()
    assert delivery.last_error == 'ConnectTimeout'


@pytest.mark.django_db
def test_client_without_webhook_gets_no_notice(make_document):
    """Fails if Fiscal. tries to notify a client system that has no webhook URL."""
    assert enqueue_notice(make_document()) is None


@pytest.mark.django_db
def test_notice_never_carries_secrets(subscribed, make_document):
    """Fails if a notice carries certificate, PIN or technical key data."""
    delivery = enqueue_notice(make_document())

    assert 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c' not in str(delivery.payload)
    assert delivery.payload['event'] == 'document.state_changed'

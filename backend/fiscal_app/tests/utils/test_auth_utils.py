"""Tests for JWT token generation and authentication emails."""

import pytest
from django.contrib.auth import get_user_model

from fiscal_app.utils import auth_utils


@pytest.mark.django_db
def test_generate_auth_tokens_contains_user_payload():
    """Fails if sign-in tokens lose the access/refresh pair or the operator identity."""
    User = get_user_model()
    user = User.objects.create_user(email='tokens@example.com', password='pass1234')

    tokens = auth_utils.generate_auth_tokens(user)

    assert tokens['user']['email'] == 'tokens@example.com'
    assert tokens['user']['id'] == user.id
    assert tokens['refresh']
    assert tokens['access']


@pytest.mark.django_db
def test_send_password_reset_code_success(monkeypatch):
    """Fails if the reset code email does not reach the operator."""
    User = get_user_model()
    user = User.objects.create_user(email='reset@example.com', password='pass1234', first_name='Reset')
    sent = {}

    def fake_send_mail(subject, message, from_email, recipient_list, fail_silently):
        sent['subject'] = subject
        sent['recipients'] = recipient_list
        return 1

    monkeypatch.setattr(auth_utils, 'send_mail', fake_send_mail)

    assert auth_utils.send_password_reset_code(user, '123456') is True
    assert sent['recipients'] == [user.email]


@pytest.mark.django_db
def test_send_password_reset_code_failure(monkeypatch):
    """Fails if a mail failure is reported as a sent reset code."""
    User = get_user_model()
    user = User.objects.create_user(email='resetfail@example.com', password='pass1234', first_name='Reset')

    def fake_send_mail(*_args, **_kwargs):
        raise RuntimeError('send failed')

    monkeypatch.setattr(auth_utils, 'send_mail', fake_send_mail)

    assert auth_utils.send_password_reset_code(user, '123456') is False


@pytest.mark.django_db
def test_send_verification_code_success(monkeypatch):
    """Fails if the verification email does not reach its recipient."""
    sent = {}

    def fake_send_mail(subject, message, from_email, recipient_list, fail_silently):
        sent['subject'] = subject
        sent['recipients'] = recipient_list
        return 1

    monkeypatch.setattr(auth_utils, 'send_mail', fake_send_mail)

    assert auth_utils.send_verification_code('verify@example.com', '654321') is True
    assert sent['recipients'] == ['verify@example.com']


@pytest.mark.django_db
def test_send_verification_code_failure(monkeypatch):
    """Fails if a mail failure is reported as a sent verification code."""
    def fake_send_mail(*_args, **_kwargs):
        raise RuntimeError('send failed')

    monkeypatch.setattr(auth_utils, 'send_mail', fake_send_mail)

    assert auth_utils.send_verification_code('verify@example.com', '654321') is False

"""Tests for the operator authentication URL modules."""

import importlib

import pytest


@pytest.mark.django_db
def test_url_modules_import_and_have_patterns():
    """Fails if a URL sub-module stops importing or loses the operator auth routes the console relies on."""
    package_urls = importlib.import_module('fiscal_app.urls')
    assert hasattr(package_urls, 'urlpatterns')

    auth_urls = importlib.import_module('fiscal_app.urls.auth')
    names = {pattern.name for pattern in auth_urls.urlpatterns}

    assert {'sign_in', 'send_passcode', 'verify_passcode_reset', 'update_password', 'validate_token'} <= names
    assert not names & {'sign_up', 'google_login'}

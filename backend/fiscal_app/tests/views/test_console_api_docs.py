"""Tests for the API docs data served to the console."""

import pytest


@pytest.mark.django_db
def test_api_docs_need_a_session(api_client):
    """Fails if the API specification is public: Fiscal. is only for signed-in operators."""
    response = api_client.get('/api/console/api-docs/')

    assert response.status_code == 401


@pytest.mark.django_db
def test_api_docs_serve_the_documented_routes(authenticated_client):
    """Fails if the console does not get the same openapi.json that documents /api/v1/."""
    spec = authenticated_client.get('/api/console/api-docs/').json()['spec']

    assert '/api/v1/documents/create/' in spec['paths']


@pytest.mark.django_db
def test_api_docs_carry_the_public_address(authenticated_client, settings):
    """Fails if the configured public address of the API does not reach the docs."""
    settings.FISCAL_API_BASE_URL = 'https://fiscal.projectapp.co/'

    data = authenticated_client.get('/api/console/api-docs/').json()

    assert data['api_base_url'] == 'https://fiscal.projectapp.co'


@pytest.mark.django_db
def test_missing_spec_answers_unavailable(authenticated_client, settings, tmp_path):
    """Fails if a missing openapi.json breaks the console instead of answering 503."""
    from fiscal_app.views.console_api_docs import _load_spec

    _load_spec.cache_clear()
    settings.FISCAL_OPENAPI_PATH = tmp_path / 'missing.json'

    response = authenticated_client.get('/api/console/api-docs/')

    _load_spec.cache_clear()
    assert response.status_code == 503

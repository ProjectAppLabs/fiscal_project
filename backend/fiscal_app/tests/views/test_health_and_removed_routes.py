"""Tests for the health probe and the removal of template demo routes."""

import pytest
from django.test import Client

from fiscal_app.services.health import beat


@pytest.mark.django_db
def test_health_identifies_project_and_environment():
    """Fails if /api/health/ stops telling external probes WHO answered (project and environment)."""
    beat()
    response = Client().get('/api/health/')

    data = response.json()
    assert response.status_code == 200
    assert (data['status'], data['project'], data['environment']) == ('ok', 'fiscal_project', 'development')


@pytest.mark.django_db
@pytest.mark.parametrize(
    'path',
    [
        '/api/sign_up/',
        '/api/google_login/',
        '/api/blogs-data/',
        '/api/products-data/',
        '/api/create-sale/',
        '/api/users/',
        '/admin-gallery/',
    ],
)
def test_removed_template_routes_are_gone(path):
    """Fails if a template demo route (public sign-up, Google login, blog, product, sale, user CRUD) is still served."""
    response = Client().post(path, {}, content_type='application/json')

    assert response.status_code == 404

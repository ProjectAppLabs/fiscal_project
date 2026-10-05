"""Tests for the Fiscal. admin site."""

import pytest
from django.test import RequestFactory
from django.urls import NoReverseMatch, reverse

from fiscal_app.admin import FiscalUserAdmin, PasswordCodeAdmin, admin_site
from fiscal_app.models import PasswordCode, User


@pytest.mark.django_db
def test_password_code_admin_disables_add_permission():
    """Fails if staff can mint password-reset codes by hand from the admin."""
    admin = PasswordCodeAdmin(PasswordCode, admin_site)
    request = RequestFactory().get('/admin/')

    assert admin.has_add_permission(request) is False


@pytest.mark.django_db
def test_admin_site_custom_sections():
    """Fails if the admin index loses a Fiscal. section or still lists template demo models."""
    User.objects.create_superuser(email='admin@example.com', password='pass1234')
    request = RequestFactory().get('/admin/')
    request.user = User.objects.get(email='admin@example.com')

    app_list = admin_site.get_app_list(request)

    object_names = {model['object_name'] for section in app_list for model in section['models']}
    assert object_names == {
        'User', 'PasswordCode', 'StagingPhaseBanner', 'ClientSystem', 'Issuer', 'SoftwareRegistration',
        'Certificate', 'NumberingRange', 'Document', 'DocumentEvent', 'Artifact', 'WebhookDelivery', 'Alert',
    }


def test_user_admin_has_no_impersonation_route():
    """Fails if the admin lets a superuser log in as an operator (removed: the console has no admin-login page)."""
    assert not hasattr(FiscalUserAdmin, 'login_as_link')
    with pytest.raises(NoReverseMatch):
        reverse('myadmin:fiscal_app_user_login_as', args=[1])


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('model_name', 'secret_field'),
    [
        ('SoftwareRegistration', 'software_pin'),
        ('Certificate', 'p12'),
        ('Certificate', 'password'),
        ('NumberingRange', 'technical_key'),
    ],
)
def test_admin_forms_never_show_secrets(admin_user, model_name, secret_field):
    """Fails if an admin change form exposes a certificate, its password, a software PIN or a technical key."""
    from fiscal_app import models

    model = getattr(models, model_name)
    request = RequestFactory().get('/admin/')
    request.user = admin_user

    fields = admin_site._registry[model].get_fields(request)

    assert secret_field not in fields

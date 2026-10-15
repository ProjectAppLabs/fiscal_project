"""Tests for the access rules of a client system and its issuers from the console: domain, subdomains, IPs, host."""

import pytest

from fiscal_app.models import ClientSystem


@pytest.fixture
def waiter(client_system):
    client, _secret = client_system
    return client


def url(client):
    return f'/api/console/client-systems/{client.pk}/'


@pytest.mark.django_db
def test_admin_registers_the_domain(console_admin_client, waiter):
    """Fails if an administrator cannot register the client system's domain with its subdomains."""
    console_admin_client.patch(url(waiter), {'domain': 'Waiter.co', 'allow_subdomains': True}, format='json')

    waiter.refresh_from_db()
    assert (waiter.domain, waiter.allow_subdomains) == ('waiter.co', True)


@pytest.mark.django_db
def test_operator_cannot_change_the_domain(authenticated_client, waiter):
    """Fails if an operator can change who may call the API."""
    response = authenticated_client.patch(url(waiter), {'domain': 'otro.co'}, format='json')

    assert response.status_code == 403


@pytest.mark.django_db
def test_domain_with_a_path_is_reduced_to_the_host(console_admin_client, waiter):
    """Fails if a pasted URL is stored instead of its host."""
    console_admin_client.patch(url(waiter), {'domain': 'https://waiter.co/admin'}, format='json')

    waiter.refresh_from_db()
    assert waiter.domain == 'waiter.co'


@pytest.mark.django_db
def test_notice_url_outside_the_domain_is_refused(console_admin_client, waiter):
    """Fails if the notice URL can point outside the registered domain."""
    waiter.domain = 'waiter.co'
    waiter.save()

    response = console_admin_client.patch(url(waiter), {'webhook_url': 'https://avisos.otro.co/fiscal/'}, format='json')

    assert response.status_code == 400


@pytest.mark.django_db
def test_invalid_ip_is_refused(console_admin_client, waiter):
    """Fails if the IP list accepts something that is not an IP or a network."""
    response = console_admin_client.patch(url(waiter), {'allowed_ips': ['203.0.113.10', 'servidor-waiter']}, format='json')

    assert response.json()['allowed_ips'] == ['«servidor-waiter» no es una IP ni una red válida.']


@pytest.mark.django_db
def test_detail_shows_the_access_rules(authenticated_client, waiter):
    """Fails if the console does not show the domain, subdomains and IPs of the client system."""
    waiter.domain, waiter.allow_subdomains, waiter.allowed_ips = 'waiter.co', True, ['203.0.113.10/32']
    waiter.save()

    data = authenticated_client.get(url(waiter)).json()

    assert (data['domain'], data['allow_subdomains'], data['allowed_ips']) == ('waiter.co', True, ['203.0.113.10/32'])


@pytest.mark.django_db
def test_new_client_system_keeps_its_domain(authenticated_client):
    """Fails if the domain chosen when creating a client system is lost."""
    authenticated_client.post(
        '/api/console/client-systems/create/', {'name': 'Waiter', 'domain': 'waiter.co', 'allow_subdomains': True}, format='json',
    )

    assert ClientSystem.objects.get(name='Waiter').domain == 'waiter.co'


@pytest.mark.django_db
def test_new_client_system_refuses_a_notice_url_outside_its_domain(authenticated_client):
    """Fails if a client system can be created with its notice URL outside its own domain."""
    response = authenticated_client.post(
        '/api/console/client-systems/create/',
        {'name': 'Waiter', 'domain': 'waiter.co', 'webhook_url': 'https://otro.co/avisos/'}, format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_admin_binds_an_issuer_to_a_subdomain(console_admin_client, waiter, issuer):
    """Fails if an administrator cannot bind an issuer to its tenant's host."""
    waiter.domain, waiter.allow_subdomains = 'waiter.co', True
    waiter.save()

    console_admin_client.patch(f'/api/console/issuers/{issuer.pk}/', {'origin_host': 'Restaurante-X.waiter.co'}, format='json')

    issuer.refresh_from_db()
    assert issuer.origin_host == 'restaurante-x.waiter.co'


@pytest.mark.django_db
def test_issuer_host_outside_the_domain_is_refused(console_admin_client, waiter, issuer):
    """Fails if an issuer can be bound to a host outside its client system's domain."""
    waiter.domain, waiter.allow_subdomains = 'waiter.co', True
    waiter.save()

    response = console_admin_client.patch(f'/api/console/issuers/{issuer.pk}/', {'origin_host': 'otro.co'}, format='json')

    assert response.status_code == 400


@pytest.mark.django_db
def test_operator_cannot_rebind_an_issuer(authenticated_client, issuer):
    """Fails if an operator can move an issuer to another tenant's host."""
    response = authenticated_client.patch(f'/api/console/issuers/{issuer.pk}/', {'origin_host': 'x.waiter.co'}, format='json')

    assert response.status_code == 403

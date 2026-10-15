"""Tests for the origin of machine API requests: domain, subdomains, IPs and issuers bound to their host."""

import pytest

from fiscal_app.authentication.signing import signed_headers
from fiscal_app.models import Issuer

from .test_issuer_endpoints import ISSUER_BODY

HOST = 'restaurante-x.waiter.co'


@pytest.fixture
def waiter_domain(client_system):
    """The client system with waiter.co registered and its subdomains allowed."""
    client, _secret = client_system
    client.domain, client.allow_subdomains = 'waiter.co', True
    client.save()
    return client


@pytest.fixture
def bound_issuer(waiter_domain, issuer):
    issuer.origin_host = HOST
    issuer.save()
    return issuer


def error_code(response):
    return response.json()['error']['code']


@pytest.mark.django_db
def test_origin_is_required_with_a_domain(signed_client, bound_issuer):
    """Fails if a client system with a domain can call without declaring its origin."""
    response = signed_client.get(f'/api/v1/issuers/{bound_issuer.nit}/')

    assert error_code(response) == 'origin_required'


@pytest.mark.django_db
def test_origin_outside_the_domain_is_refused(signed_client, bound_issuer):
    """Fails if a request declaring a host outside waiter.co is accepted."""
    response = signed_client.get(f'/api/v1/issuers/{bound_issuer.nit}/', origin='restaurante-x.otro.co')

    assert response.status_code == 403


@pytest.mark.django_db
def test_bound_issuer_answers_its_own_host(signed_client, bound_issuer):
    """Fails if the issuer refuses the host it is bound to."""
    response = signed_client.get(f'/api/v1/issuers/{bound_issuer.nit}/', origin=HOST)

    assert response.status_code == 200


@pytest.mark.django_db
def test_bound_issuer_refuses_another_subdomain(signed_client, bound_issuer):
    """Fails if one tenant of the client system can read another tenant's issuer."""
    response = signed_client.get(f'/api/v1/issuers/{bound_issuer.nit}/', origin='restaurante-y.waiter.co')

    assert error_code(response) == 'origin_mismatch'


@pytest.mark.django_db
def test_origin_cannot_be_swapped_after_signing(signed_client, bound_issuer):
    """Fails if the declared origin is not covered by the signature."""
    path = f'/api/v1/issuers/{bound_issuer.nit}/'
    headers = signed_headers(signed_client.key_id, signed_client.secret, 'GET', path, origin='restaurante-y.waiter.co')
    headers['X-Fiscal-Origin'] = HOST

    response = signed_client.get(path, sign=False, headers=headers)

    assert error_code(response) == 'signature_invalid'


@pytest.mark.django_db
def test_new_issuer_is_bound_to_its_origin(signed_client, waiter_domain):
    """Fails if an issuer created through the API is not bound to the host that created it."""
    signed_client.put('/api/v1/issuers/900373115/update/', ISSUER_BODY, origin=HOST)

    assert Issuer.objects.get(nit='900373115').origin_host == HOST


@pytest.mark.django_db
def test_document_for_another_tenant_is_refused(signed_client, bound_issuer, document_envelope):
    """Fails if a document can be queued for an issuer bound to another host."""
    response = signed_client.post('/api/v1/documents/create/', document_envelope(), origin='restaurante-y.waiter.co')

    assert error_code(response) == 'origin_mismatch'


@pytest.mark.django_db
def test_ip_outside_the_list_is_refused(signed_client, bound_issuer):
    """Fails if a client system with an IP list can call from another address."""
    bound_issuer.client.allowed_ips = ['203.0.113.10/32']
    bound_issuer.client.save()

    response = signed_client.get(f'/api/v1/issuers/{bound_issuer.nit}/', origin=HOST, remote_addr='198.51.100.7')

    assert error_code(response) == 'ip_not_allowed'


@pytest.mark.django_db
def test_ip_in_the_list_is_accepted(signed_client, bound_issuer):
    """Fails if a listed IP is refused."""
    bound_issuer.client.allowed_ips = ['203.0.113.0/24']
    bound_issuer.client.save()

    response = signed_client.get(f'/api/v1/issuers/{bound_issuer.nit}/', origin=HOST, remote_addr='203.0.113.10')

    assert response.status_code == 200


@pytest.mark.django_db
def test_client_without_domain_needs_no_origin(signed_client, issuer):
    """Fails if a client system without a domain must start declaring an origin."""
    response = signed_client.get(f'/api/v1/issuers/{issuer.nit}/')

    assert response.status_code == 200

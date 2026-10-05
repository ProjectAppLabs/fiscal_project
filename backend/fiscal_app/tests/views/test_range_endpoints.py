"""Tests for the numbering range endpoints of the machine API."""

import pytest

RANGE_BODY = {
    'kind': 'invoice', 'resolution_number': '18764000001234', 'resolution_date': '2026-09-01', 'prefix': 'fe1',
    'number_from': 1, 'number_to': 5000, 'valid_from': '2026-09-01', 'valid_to': '2028-09-01',
    'technical_key': 'clave-tecnica-123', 'establishment': 'Sede Poblado',
}


@pytest.mark.django_db
def test_create_range_returns_201_without_the_key(signed_client, issuer):
    """Fails if a valid range is refused, or if the response carries its technical key."""
    response = signed_client.post(f'/api/v1/issuers/{issuer.nit}/ranges/create/', RANGE_BODY)

    assert response.status_code == 201
    assert response.json()['prefix'] == 'FE1'
    assert 'clave-tecnica-123' not in response.content.decode()


@pytest.mark.django_db
def test_inverted_range_is_refused(signed_client, issuer):
    """Fails if a range that ends before it starts is stored."""
    response = signed_client.post(
        f'/api/v1/issuers/{issuer.nit}/ranges/create/', {**RANGE_BODY, 'number_from': 9000}
    )

    assert response.json()['error']['code'] == 'invalid_range'


@pytest.mark.django_db
def test_invoice_range_needs_its_technical_key(signed_client, issuer):
    """Fails if an invoice range is stored without the technical key every CUFE needs."""
    response = signed_client.post(f'/api/v1/issuers/{issuer.nit}/ranges/create/', {**RANGE_BODY, 'technical_key': ''})

    assert response.json()['error']['code'] == 'technical_key_required'


@pytest.mark.django_db
def test_contingency_range_needs_no_technical_key(signed_client, issuer):
    """Fails if a paper contingency range (type 03) is refused for lacking a technical key it never has."""
    body = {**RANGE_BODY, 'kind': 'contingency', 'technical_key': ''}

    response = signed_client.post(f'/api/v1/issuers/{issuer.nit}/ranges/create/', body)

    assert response.status_code == 201


@pytest.mark.django_db
def test_prefix_longer_than_four_is_refused(signed_client, issuer):
    """Fails if a prefix longer than the 4 characters the DIAN allows is stored."""
    response = signed_client.post(f'/api/v1/issuers/{issuer.nit}/ranges/create/', {**RANGE_BODY, 'prefix': 'SETPX'})

    assert response.status_code == 400
    assert 'prefix' in response.json()['error']['fields']


@pytest.mark.django_db
def test_repeated_range_is_refused(signed_client, issuer):
    """Fails if the same resolution and prefix can be registered twice."""
    signed_client.post(f'/api/v1/issuers/{issuer.nit}/ranges/create/', RANGE_BODY)

    response = signed_client.post(f'/api/v1/issuers/{issuer.nit}/ranges/create/', RANGE_BODY)

    assert response.status_code == 409


@pytest.mark.django_db
def test_list_ranges_of_the_issuer(signed_client, issuer, invoice_range):
    """Fails if the client system cannot list the ranges registered for its business."""
    response = signed_client.get(f'/api/v1/issuers/{issuer.nit}/ranges/')

    assert [row['prefix'] for row in response.json()] == ['SETP']

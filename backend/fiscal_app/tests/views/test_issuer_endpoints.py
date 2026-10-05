"""Tests for the issuer, certificate and software endpoints of the machine API."""

import pytest

from fiscal_app.services.self_signed import self_signed_p12

ISSUER_BODY = {
    'dv': '3', 'person_type': '1', 'legal_name': 'Restaurante de Prueba SAS', 'trade_name': 'La Prueba',
    'tax_responsibilities': ['o-13'], 'tax_scheme': '04', 'address_line': 'Calle 10 # 43-12',
    'municipality_code': '05001', 'department_code': '05', 'postal_code': '050021',
    'email': 'facturacion@restaurante.test', 'environment': '2',
}


@pytest.mark.django_db
def test_create_issuer_returns_201(signed_client):
    """Fails if a client system cannot register a business with a valid NIT."""
    response = signed_client.put('/api/v1/issuers/900373115/update/', ISSUER_BODY)

    assert response.status_code == 201
    assert response.json()['tax_responsibilities'] == ['O-13']


@pytest.mark.django_db
def test_update_issuer_returns_200(signed_client, issuer):
    """Fails if updating an existing business creates a second one instead."""
    response = signed_client.put(f'/api/v1/issuers/{issuer.nit}/update/', {**ISSUER_BODY, 'legal_name': 'Nuevo SAS'})

    assert response.status_code == 200
    assert response.json()['legal_name'] == 'Nuevo SAS'


@pytest.mark.django_db
def test_wrong_check_digit_is_refused(signed_client):
    """Fails if a business is registered with a check digit that does not belong to its NIT."""
    response = signed_client.put('/api/v1/issuers/900373115/update/', {**ISSUER_BODY, 'dv': '9'})

    assert response.status_code == 400
    assert response.json()['error']['code'] == 'invalid_dv'


@pytest.mark.django_db
def test_municipality_outside_its_department_is_refused(signed_client):
    """Fails if the issuer address can point to a municipality of another department (DANE codes)."""
    response = signed_client.put('/api/v1/issuers/900373115/update/', {**ISSUER_BODY, 'department_code': '11'})

    assert response.json()['error']['code'] == 'municipality_department_mismatch'


@pytest.mark.django_db
def test_other_client_cannot_see_the_issuer(other_signed_client, issuer):
    """Fails if a client system can read a business of another client system by its NIT."""
    response = other_signed_client.get(f'/api/v1/issuers/{issuer.nit}/')

    assert response.status_code == 404
    assert response.json()['error']['code'] == 'issuer_not_found'


@pytest.mark.django_db
def test_certificate_upload_returns_only_public_data(signed_client, issuer):
    """Fails if the certificate upload answers with the .p12 or its password."""
    p12 = self_signed_p12('Restaurante de Prueba SAS', 'clave-987')

    response = signed_client.put(
        f'/api/v1/issuers/{issuer.nit}/certificate/update/', {'p12': p12, 'password': 'clave-987'}
    )

    assert response.status_code == 200
    assert 'clave-987' not in response.content.decode()
    assert p12[:60] not in response.content.decode()


@pytest.mark.django_db
def test_expired_certificate_upload_is_refused(signed_client, issuer):
    """Fails if an expired certificate can be uploaded for an issuer."""
    p12 = self_signed_p12('Restaurante de Prueba SAS', 'clave', days=-1)

    response = signed_client.put(f'/api/v1/issuers/{issuer.nit}/certificate/update/', {'p12': p12, 'password': 'clave'})

    assert response.json()['error']['code'] == 'certificate_expired'


@pytest.mark.django_db
def test_software_registration_hides_the_pin(signed_client, issuer):
    """Fails if the software PIN (it goes into every CUDE) is returned by the API."""
    body = {'environment': '2', 'software_id': 'abc-123', 'software_pin': '54321', 'test_set_id': 'set-1'}

    response = signed_client.put(f'/api/v1/issuers/{issuer.nit}/software/update/', body)

    assert response.json()['has_software_pin'] is True
    assert '54321' not in response.content.decode()


@pytest.mark.django_db
def test_new_software_registration_replaces_the_active_one(signed_client, issuer):
    """Fails if two software registrations stay active in the same environment."""
    path = f'/api/v1/issuers/{issuer.nit}/software/update/'
    signed_client.put(path, {'environment': '2', 'software_id': 'uno', 'software_pin': '1'})
    signed_client.put(path, {'environment': '2', 'software_id': 'dos', 'software_pin': '2'})

    active = issuer.software_registrations.filter(active=True)

    assert list(active.values_list('software_id', flat=True)) == ['dos']


@pytest.mark.django_db
def test_issuer_detail_never_shows_secrets(signed_client, issuer, invoice_range):
    """Fails if the issuer detail exposes a technical key, PIN or certificate."""
    response = signed_client.get(f'/api/v1/issuers/{issuer.nit}/')

    assert 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c' not in response.content.decode()
    assert response.json()['numbering_ranges'][0]['has_technical_key'] is True

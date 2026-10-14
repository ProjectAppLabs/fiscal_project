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


def certificate_and_key(password='x'):
    """The certificate (DER) and its private key (PEM, unencrypted) of a self-signed .p12, each in base64."""
    import base64

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.serialization import pkcs12

    key, certificate, _others = pkcs12.load_key_and_certificates(
        base64.b64decode(self_signed_p12('Restaurante de Prueba SAS', password)), password.encode(),
    )
    key_pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    return (base64.b64encode(certificate.public_bytes(serialization.Encoding.DER)).decode(),
            base64.b64encode(key_pem).decode())


@pytest.mark.django_db
def test_certificate_and_key_can_be_sent_separately(signed_client, issuer):
    """Fails if a client system cannot load a certificate the entity delivered as .cer plus .key."""
    certificate, key = certificate_and_key()

    response = signed_client.put(
        f'/api/v1/issuers/{issuer.nit}/certificate/update/', {'certificate': certificate, 'private_key': key}
    )

    assert response.status_code == 200
    assert (response.json()['subject'], response.json()['chain_complete']) == ('CN=Restaurante de Prueba SAS', True)


@pytest.mark.django_db
def test_certificate_without_its_key_is_refused(signed_client, issuer):
    """Fails if a certificate alone is accepted through the API: it could never sign."""
    certificate, _key = certificate_and_key()

    response = signed_client.put(f'/api/v1/issuers/{issuer.nit}/certificate/update/', {'certificate': certificate})

    assert response.json()['error']['fields'] == {'private_key': ['Envía el certificado y su llave privada.']}


@pytest.mark.django_db
def test_certificate_that_is_not_base64_is_refused(signed_client, issuer):
    """Fails if a certificate field that is not base64 reaches the parser instead of a clear field error."""
    response = signed_client.put(
        f'/api/v1/issuers/{issuer.nit}/certificate/update/', {'certificate': 'no es base64', 'private_key': 'tampoco'}
    )

    assert response.json()['error']['fields']['certificate'] == ['No es un base64 válido.']


@pytest.mark.django_db
def test_key_of_another_certificate_is_refused(signed_client, issuer):
    """Fails if a private key that does not belong to the certificate is accepted."""
    certificate, _key = certificate_and_key()
    _other_certificate, other_key = certificate_and_key()

    response = signed_client.put(
        f'/api/v1/issuers/{issuer.nit}/certificate/update/', {'certificate': certificate, 'private_key': other_key}
    )

    assert response.json()['error']['code'] == 'key_mismatch'

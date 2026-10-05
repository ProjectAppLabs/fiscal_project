"""Tests for enrolling a business from the operator console and starting its DIAN test set."""

import base64
from unittest import mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from fiscal_app.models import ClientSystem, Issuer, SoftwareRegistration, TestSetRun
from fiscal_app.services.self_signed import self_signed_p12

ISSUER = {
    'nit': '900373115', 'dv': '3', 'person_type': '1', 'legal_name': 'ProjectApp', 'tax_responsibilities': ['ZZ'],
    'address_line': 'Calle 10 #43-12', 'municipality_code': '05001', 'department_code': '05', 'email': 'f@projectapp.co',
}
HABILITATION_RANGE = {
    'kind': 'invoice', 'resolution_number': '18760000001', 'prefix': 'SETP', 'number_from': 990000000,
    'number_to': 995000000, 'valid_from': '2019-01-19', 'valid_to': '2030-01-19', 'technical_key': 'clave-del-catalogo',
}


def p12_upload(password='clave-1'):
    return SimpleUploadedFile('certificado.p12', base64.b64decode(self_signed_p12('ProjectApp', password)),
                              content_type='application/x-pkcs12')


@pytest.mark.django_db
@pytest.mark.parametrize('method,path', [
    ('post', '/api/console/client-systems/create/'), ('post', '/api/console/issuers/create/'),
    ('post', '/api/console/issuers/1/certificate/'), ('get', '/api/console/issuers/1/test-set/'),
])
def test_onboarding_requires_an_operator(api_client, method, path):
    """Fails if anyone without an operator session can enrol businesses or upload certificates."""
    assert getattr(api_client, method)(path).status_code == 401


@pytest.mark.django_db
def test_new_client_system_shows_its_secret_once(authenticated_client):
    """Fails if creating a client system does not return the secret the system needs to sign its requests."""
    response = authenticated_client.post('/api/console/client-systems/create/', {'name': 'ProjectApp'}, format='json')

    body = response.json()
    assert response.status_code == 201
    assert body['key_id'].startswith('fk_') and len(body['secret']) > 30
    assert body['secret'] not in authenticated_client.get('/api/console/client-systems/').content.decode()


@pytest.mark.django_db
def test_client_system_names_are_unique(authenticated_client, client_system):
    """Fails if two client systems can share a name and be confused by operators."""
    response = authenticated_client.post('/api/console/client-systems/create/', {'name': 'Waiter'}, format='json')

    assert response.status_code == 400


@pytest.mark.django_db
def test_operator_enrols_an_issuer(authenticated_client, client_system):
    """Fails if a valid business cannot be enrolled under a client system from the console."""
    client, _secret = client_system

    response = authenticated_client.post('/api/console/issuers/create/', {**ISSUER, 'client_id': client.pk}, format='json')

    assert response.status_code == 201
    assert Issuer.objects.get(pk=response.json()['id']).client == client


@pytest.mark.django_db
def test_wrong_check_digit_is_refused(authenticated_client, client_system):
    """Fails if a NIT with a wrong check digit is enrolled; the DIAN would reject every document."""
    client, _secret = client_system

    response = authenticated_client.post('/api/console/issuers/create/', {**ISSUER, 'dv': '4', 'client_id': client.pk}, format='json')

    assert response.status_code == 400
    assert 'dv' in response.json()


@pytest.mark.django_db
def test_same_nit_twice_in_a_client_is_refused(authenticated_client, issuer):
    """Fails if a business is enrolled twice in the same client system."""
    response = authenticated_client.post(
        '/api/console/issuers/create/', {**ISSUER, 'nit': issuer.nit, 'dv': issuer.dv, 'client_id': issuer.client_id}, format='json'
    )

    assert response.json()['nit'] == ['Ese NIT ya está inscrito en ese sistema cliente.']


@pytest.mark.django_db
def test_certificate_upload_is_validated_and_kept_encrypted(authenticated_client, issuer):
    """Fails if an uploaded .p12 is not stored as the active certificate or its password comes back."""
    response = authenticated_client.post(
        f'/api/console/issuers/{issuer.pk}/certificate/', {'p12': p12_upload(), 'password': 'clave-1'}, format='multipart'
    )

    assert response.status_code == 201
    assert response.json()['subject'] == 'CN=ProjectApp'
    assert 'clave-1' not in response.content.decode()
    assert issuer.certificates.filter(active=True).count() == 1


@pytest.mark.django_db
def test_wrong_certificate_password_is_explained(authenticated_client, issuer):
    """Fails if a .p12 that does not open answers with a server error instead of saying why."""
    response = authenticated_client.post(
        f'/api/console/issuers/{issuer.pk}/certificate/', {'p12': p12_upload(), 'password': 'otra'}, format='multipart'
    )

    assert response.status_code == 400
    assert response.json()['code'] == 'invalid_certificate'


@pytest.mark.django_db
def test_software_and_range_complete_the_enrolment(authenticated_client, issuer):
    """Fails if the software from the DIAN portal and the habilitación range cannot be registered."""
    software = authenticated_client.post(f'/api/console/issuers/{issuer.pk}/software/', {
        'environment': '2', 'software_id': 'sw-123', 'software_pin': '12345', 'test_set_id': 'set-1',
    }, format='json')
    numbering = authenticated_client.post(f'/api/console/issuers/{issuer.pk}/ranges/', HABILITATION_RANGE, format='json')

    assert (software.status_code, numbering.status_code) == (201, 201)
    assert '12345' not in software.content.decode()
    assert SoftwareRegistration.objects.get(issuer=issuer).test_set_id == 'set-1'


@pytest.mark.django_db
def test_test_set_status_shows_readiness(authenticated_client, ready_issuer):
    """Fails if the console cannot tell what the issuer still lacks for the test set."""
    data = authenticated_client.get(f'/api/console/issuers/{ready_issuer.pk}/test-set/').json()

    assert data['readiness']['test_set_id'] is False
    assert data['run'] is None


@pytest.mark.django_db
def test_test_set_is_refused_when_not_ready(authenticated_client, ready_issuer):
    """Fails if starting the set without a TestSetId does not explain what is missing."""
    response = authenticated_client.post(f'/api/console/issuers/{ready_issuer.pk}/test-set/', {}, format='json')

    assert response.status_code == 409
    assert 'TestSetId' in response.json()['detail']


@pytest.mark.django_db
def test_operator_starts_and_checks_the_test_set(authenticated_client, ready_issuer):
    """Fails if the console cannot start the set or ask the DIAN for its result."""
    SoftwareRegistration.objects.filter(issuer=ready_issuer).update(test_set_id='set-1')
    run = TestSetRun.objects.create(issuer=ready_issuer, test_set_id='set-1')

    with mock.patch('fiscal_app.services.test_set.start', return_value=run) as start, \
            mock.patch('fiscal_app.services.test_set.check', return_value=run) as check:
        started = authenticated_client.post(f'/api/console/issuers/{ready_issuer.pk}/test-set/', {'invoices': 8}, format='json')
        checked = authenticated_client.post(f'/api/console/test-sets/{run.pk}/check/')

    assert (started.status_code, checked.status_code) == (201, 200)
    assert start.call_args.kwargs == {'invoices': 8}
    assert check.call_count == 1


@pytest.mark.django_db
def test_test_set_size_is_bounded(authenticated_client, ready_issuer):
    """Fails if an operator can ask for an absurd number of invoices in one set."""
    response = authenticated_client.post(f'/api/console/issuers/{ready_issuer.pk}/test-set/', {'invoices': 1000}, format='json')

    assert response.status_code == 400
    assert ClientSystem.objects.count() == 1

"""Tests for managing an issuer from the console: correcting its data, switching it or its ranges off, and its test runs."""

import pytest

from fiscal_app.models import TestSetRun

ISSUER_BODY = {
    'dv': '3', 'person_type': '1', 'legal_name': 'Restaurante de Prueba SAS', 'address_line': 'Calle 10 # 43-12',
    'municipality_code': '05001', 'department_code': '05', 'email': 'facturacion@restaurante.test',
}


@pytest.mark.django_db
def test_operator_corrects_the_issuer_name(authenticated_client, issuer):
    """Fails if a typo in the legal name can only be fixed through the API of the client system."""
    response = authenticated_client.patch(f'/api/console/issuers/{issuer.pk}/', {'legal_name': 'Restaurante La Prueba SAS'}, format='json')

    assert response.json()['legal_name'] == 'Restaurante La Prueba SAS'


@pytest.mark.django_db
def test_edit_takes_the_department_from_the_municipality(authenticated_client, issuer):
    """Fails if moving the issuer to Cali leaves Antioquia as its department."""
    authenticated_client.patch(f'/api/console/issuers/{issuer.pk}/', {'municipality_code': '76001'}, format='json')

    issuer.refresh_from_db()
    assert (issuer.municipality_code, issuer.department_code) == ('76001', '76')


@pytest.mark.django_db
def test_edit_never_changes_the_nit(authenticated_client, issuer):
    """Fails if the console can change the NIT, which identifies the issuer before the DIAN."""
    authenticated_client.patch(f'/api/console/issuers/{issuer.pk}/', {'nit': '800000000', 'trade_name': 'La Prueba'}, format='json')

    issuer.refresh_from_db()
    assert (issuer.nit, issuer.trade_name) == ('900373115', 'La Prueba')


@pytest.mark.django_db
def test_edit_never_moves_to_production(authenticated_client, issuer):
    """Fails if editing the data can skip the guided move to production."""
    authenticated_client.patch(f'/api/console/issuers/{issuer.pk}/', {'environment': '1'}, format='json')

    issuer.refresh_from_db()
    assert issuer.environment == '2'


@pytest.mark.django_db
def test_edit_refuses_a_wrong_check_digit(authenticated_client, issuer):
    """Fails if the console stores a check digit that does not belong to the NIT."""
    response = authenticated_client.patch(f'/api/console/issuers/{issuer.pk}/', {'dv': '9'}, format='json')

    assert response.status_code == 400


@pytest.mark.django_db
def test_client_system_cannot_create_an_issuer_in_production(signed_client):
    """Fails if a client system can register a business straight in production, without the DIAN test set."""
    response = signed_client.put('/api/v1/issuers/900373115/update/', {**ISSUER_BODY, 'environment': '1'})

    assert response.json()['error']['code'] == 'environment_locked'


@pytest.mark.django_db
def test_client_system_cannot_move_an_issuer_to_production(signed_client, issuer):
    """Fails if updating a business is a back door to production (it must go through /production/promote/)."""
    response = signed_client.put(f'/api/v1/issuers/{issuer.nit}/update/', {**ISSUER_BODY, 'environment': '1'})

    issuer.refresh_from_db()
    assert (response.json()['error']['code'], issuer.environment) == ('environment_locked', '2')


@pytest.mark.django_db
def test_admin_switches_an_issuer_off(console_admin_client, issuer):
    """Fails if an administrator cannot stop a business from issuing through Fiscal."""
    console_admin_client.post(f'/api/console/issuers/{issuer.pk}/activation/', {'active': False}, format='json')

    issuer.refresh_from_db()
    assert issuer.active is False


@pytest.mark.django_db
def test_operator_cannot_switch_an_issuer_off(authenticated_client, issuer):
    """Fails if a non-administrator can stop a business from issuing."""
    response = authenticated_client.post(f'/api/console/issuers/{issuer.pk}/activation/', {'active': False}, format='json')

    issuer.refresh_from_db()
    assert (response.status_code, issuer.active) == (403, True)


@pytest.mark.django_db
def test_inactive_issuer_cannot_issue(signed_client, document_envelope, ready_issuer):
    """Fails if a switched-off issuer still gets documents queued for the DIAN."""
    ready_issuer.active = False
    ready_issuer.save(update_fields=['active'])

    response = signed_client.post('/api/v1/documents/create/', document_envelope())

    assert (response.status_code, response.json()['error']['code']) == (409, 'issuer_inactive')


@pytest.mark.django_db
def test_admin_switches_a_range_off(console_admin_client, invoice_range):
    """Fails if a wrongly registered range can only be switched off in the database."""
    response = console_admin_client.patch(
        f'/api/console/issuers/{invoice_range.issuer_id}/ranges/{invoice_range.pk}/', {'active': False}, format='json'
    )

    invoice_range.refresh_from_db()
    assert (response.json()['active'], invoice_range.active) == (False, False)


@pytest.mark.django_db
def test_range_of_another_issuer_is_not_found(console_admin_client, invoice_range):
    """Fails if a range can be reached through the URL of an issuer it does not belong to."""
    response = console_admin_client.patch(f'/api/console/issuers/999/ranges/{invoice_range.pk}/', {'active': False}, format='json')

    assert response.status_code == 404


@pytest.mark.django_db
def test_test_runs_list_counts_the_accepted_documents(authenticated_client, issuer):
    """Fails if the history of test set runs does not say how many documents the DIAN accepted in each."""
    TestSetRun.objects.create(issuer=issuer, test_set_id='set', state=TestSetRun.State.REJECTED,
                              entries=[{'status': 'accepted'}, {'status': 'rejected'}, {'status': 'accepted'}])

    response = authenticated_client.get(f'/api/console/issuers/{issuer.pk}/test-set/runs/')

    row = response.json()['results'][0]
    assert (row['total'], row['accepted'], row['rejected']) == (3, 2, 1)

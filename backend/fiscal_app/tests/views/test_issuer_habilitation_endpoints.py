"""Tests for the machine API that runs an issuer's DIAN test set and moves it to production."""

from unittest import mock

import pytest

from fiscal_app.models import SoftwareRegistration, TestSetRun


@pytest.mark.django_db
def test_test_set_status_lists_what_is_missing(signed_client, ready_issuer):
    """Fails if a client system cannot see that the issuer still lacks its TestSetId."""
    response = signed_client.get(f'/api/v1/issuers/{ready_issuer.nit}/test-set/')

    assert response.json() == {'readiness': {'environment': True, 'certificate': True, 'software': True,
                                             'test_set_id': False, 'range': True}, 'run': None}


@pytest.mark.django_db
def test_test_set_not_ready_is_explained(signed_client, ready_issuer):
    """Fails if starting a set without a TestSetId answers anything but a 409 that says what is missing."""
    response = signed_client.post(f'/api/v1/issuers/{ready_issuer.nit}/test-set/start/', {})

    assert response.status_code == 409
    assert response.json()['error']['code'] == 'test_set_not_ready'


@pytest.mark.django_db
def test_client_system_starts_the_test_set_with_the_default_size(signed_client, ready_issuer):
    """Fails if a start without sizes does not ask for the 30 invoices, 10 credit and 10 debit notes of the catalogue."""
    run = TestSetRun.objects.create(issuer=ready_issuer, test_set_id='set-1')

    with mock.patch('fiscal_app.services.test_set.start', return_value=run) as start:
        response = signed_client.post(f'/api/v1/issuers/{ready_issuer.nit}/test-set/start/', {})

    assert response.status_code == 201
    assert start.call_args.kwargs == {'invoices': 30, 'credit_notes': 10, 'debit_notes': 10}


@pytest.mark.django_db
def test_test_set_notes_are_bounded_by_one_zip(signed_client, ready_issuer):
    """Fails if more notes are accepted than fit in the single ZIP the DIAN takes (50 documents, annex §7.8)."""
    response = signed_client.post(
        f'/api/v1/issuers/{ready_issuer.nit}/test-set/start/', {'credit_notes': 30, 'debit_notes': 30},
    )

    assert response.status_code == 400
    assert 'notes' in response.json()['error']['fields']


@pytest.mark.django_db
def test_check_asks_the_dian_about_the_latest_run(signed_client, ready_issuer):
    """Fails if checking the set does not refresh the latest run from the DIAN."""
    TestSetRun.objects.create(issuer=ready_issuer, test_set_id='old')
    latest = TestSetRun.objects.create(issuer=ready_issuer, test_set_id='set-1')

    with mock.patch('fiscal_app.services.test_set.check', return_value=latest) as check:
        response = signed_client.post(f'/api/v1/issuers/{ready_issuer.nit}/test-set/check/', {})

    assert check.call_args.args == (latest,)
    assert response.json()['id'] == latest.pk


@pytest.mark.django_db
def test_check_without_a_run_is_not_found(signed_client, ready_issuer):
    """Fails if checking an issuer that never started a set answers anything but test_set_not_found."""
    response = signed_client.post(f'/api/v1/issuers/{ready_issuer.nit}/test-set/check/', {})

    assert response.status_code == 404
    assert response.json()['error']['code'] == 'test_set_not_found'


@pytest.mark.django_db
def test_other_client_cannot_start_the_test_set(other_signed_client, ready_issuer):
    """Fails if a client system can send the DIAN test set of a business of another client system."""
    response = other_signed_client.post(f'/api/v1/issuers/{ready_issuer.nit}/test-set/start/', {})

    assert response.json()['error']['code'] == 'issuer_not_found'


@pytest.mark.django_db
def test_production_status_lists_what_is_missing(signed_client, ready_issuer):
    """Fails if an issuer only in habilitación looks ready for production through the API."""
    response = signed_client.get(f'/api/v1/issuers/{ready_issuer.nit}/production/')

    assert response.json()['readiness']['test_set_accepted'] is False


@pytest.mark.django_db
def test_production_software_is_copied_through_the_api(signed_client, ready_issuer):
    """Fails if the client system cannot reuse the habilitación SoftwareID and PIN for production."""
    response = signed_client.post(f'/api/v1/issuers/{ready_issuer.nit}/production/copy-software/', {})

    assert response.json()['readiness']['software'] is True
    assert SoftwareRegistration.objects.get(issuer=ready_issuer, environment='1').software_id == 'sw-1'


@pytest.mark.django_db
def test_promotion_needs_an_explicit_confirmation(signed_client, ready_issuer):
    """Fails if a business moves to production without the client confirming it is «Habilitado» at the DIAN."""
    response = signed_client.post(f'/api/v1/issuers/{ready_issuer.nit}/production/promote/', {})

    assert response.json()['error']['code'] == 'confirmation_required'


@pytest.mark.django_db
def test_promotion_of_an_issuer_not_ready_is_refused(signed_client, ready_issuer):
    """Fails if an issuer without an accepted set reaches production, or the refusal is not a 409."""
    response = signed_client.post(f'/api/v1/issuers/{ready_issuer.nit}/production/promote/', {'confirm': True})

    ready_issuer.refresh_from_db()
    assert (response.status_code, response.json()['error']['code']) == (409, 'production_not_ready')
    assert ready_issuer.environment == '2'

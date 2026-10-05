"""Tests for the operator console API (JWT)."""

import pytest

from fiscal_app.models import Document, DocumentEvent
from fiscal_app.models.choices import DocumentState


@pytest.fixture
def fake_data(make_document):
    """One document in each state; the rejected one carries a DIAN rule."""
    for offset, state in enumerate(DocumentState.values):
        errors = [{'code': 'FAD06', 'message': 'Regla incumplida'}] if state == DocumentState.REJECTED else []
        make_document(idempotency_key=f'waiter:{offset}', number=990_000_001 + offset, state=state, errors=errors)


@pytest.mark.django_db
def test_summary_counts_documents_by_state(authenticated_client, fake_data):
    """Fails if the dashboard counters do not reflect the documents in each state."""
    response = authenticated_client.get('/api/console/summary/')

    documents = response.json()['documents']
    assert documents['total'] == len(DocumentState.values)
    assert set(documents['by_state'].values()) == {1}


@pytest.mark.django_db
def test_summary_shows_the_last_rejection(authenticated_client, fake_data):
    """Fails if the dashboard does not show the latest DIAN rejection with its rule."""
    response = authenticated_client.get('/api/console/summary/')

    assert response.json()['last_rejection']['errors'][0]['code'] == 'FAD06'


@pytest.mark.django_db
def test_empty_summary_has_no_rejection(authenticated_client):
    """Fails if an empty installation breaks the dashboard instead of showing zeros."""
    data = authenticated_client.get('/api/console/summary/').json()

    assert data['documents']['total'] == 0
    assert data['last_rejection'] is None


@pytest.mark.django_db
def test_console_requires_an_operator_session(api_client):
    """Fails if the console API answers without an operator session."""
    assert api_client.get('/api/console/summary/').status_code == 401


@pytest.mark.django_db
def test_client_system_signature_does_not_open_the_console(signed_client):
    """Fails if a client system's HMAC signature can read the operator console."""
    response = signed_client.get('/api/console/summary/')

    assert response.status_code == 401


@pytest.mark.django_db
def test_documents_are_filtered_by_state(authenticated_client, fake_data):
    """Fails if filtering by state returns documents in other states."""
    response = authenticated_client.get('/api/console/documents/?state=rejected')

    assert [row['state'] for row in response.json()['results']] == ['rejected']


@pytest.mark.django_db
def test_documents_are_filtered_by_issuer(authenticated_client, fake_data):
    """Fails if filtering by an unknown NIT still returns documents."""
    response = authenticated_client.get('/api/console/documents/?issuer=111111111')

    assert response.json()['count'] == 0


@pytest.mark.django_db
def test_document_list_is_paginated(authenticated_client, fake_data):
    """Fails if the list is not paginated with count and links."""
    data = authenticated_client.get('/api/console/documents/').json()

    assert data['count'] == len(DocumentState.values)
    assert data['next'] is None


@pytest.mark.django_db
def test_document_detail_shows_history(authenticated_client, fake_data):
    """Fails if support cannot see a document's content and its event history."""
    document = Document.objects.get(state=DocumentState.REJECTED)
    DocumentEvent.objects.create(document=document, state=DocumentState.REJECTED, detail={'errors': document.errors})

    data = authenticated_client.get(f'/api/console/documents/{document.pk}/').json()

    assert data['full_number'] == document.full_number
    assert data['events'][0]['state'] == 'rejected'


@pytest.mark.django_db
def test_unknown_document_is_not_found(authenticated_client):
    """Fails if a missing document answers anything but 404."""
    assert authenticated_client.get('/api/console/documents/999999/').status_code == 404


@pytest.mark.django_db
def test_operator_downloads_the_contingency_letter(authenticated_client, issuer):
    """Fails if the console does not hand the operator the letter draft with the DIAN's mailbox and subject."""
    response = authenticated_client.get(f'/api/console/issuers/{issuer.pk}/contingency-letter/?from=2026-10-01&to=2026-10-03')

    assert response.status_code == 200
    assert response['Content-Type'] == 'application/pdf'
    assert response['X-Fiscal-Mail-To'] == 'contingencia.facturadorvp@dian.gov.co'
    assert response.content.startswith(b'%PDF')


@pytest.mark.django_db
def test_contingency_letter_needs_a_valid_period(authenticated_client, issuer):
    """Fails if a letter is drafted without a period or with the dates reversed."""
    url = f'/api/console/issuers/{issuer.pk}/contingency-letter/'

    assert authenticated_client.get(url).json()['code'] == 'invalid_period'
    assert authenticated_client.get(f'{url}?from=2026-10-05&to=2026-10-01').status_code == 400


@pytest.mark.django_db
def test_contingency_letter_is_only_for_operators(api_client, issuer):
    """Fails if anyone without an operator session can download an issuer's letter."""
    assert api_client.get(f'/api/console/issuers/{issuer.pk}/contingency-letter/?from=2026-10-01&to=2026-10-03').status_code == 401

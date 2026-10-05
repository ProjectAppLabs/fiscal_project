"""Tests for the document endpoints of the machine API."""

from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from fiscal_app.models import Document
from fiscal_app.tests.conftest import restaurant_bill

CREATE = '/api/v1/documents/create/'


@pytest.mark.django_db
def test_valid_document_is_queued(signed_client, document_envelope):
    """Fails if a valid document is not accepted with 202 and left in the queue."""
    response = signed_client.post(CREATE, document_envelope())

    assert response.status_code == 202
    assert response.json()['state'] == 'queued'


@pytest.mark.django_db
def test_resending_the_same_body_returns_the_same_document(signed_client, document_envelope):
    """Fails if a retry after a network cut creates a second document."""
    envelope = document_envelope()
    first = signed_client.post(CREATE, envelope).json()

    again = signed_client.post(CREATE, envelope)

    assert again.status_code == 200
    assert again.json()['id'] == first['id']
    assert Document.objects.count() == 1


@pytest.mark.django_db
def test_same_key_with_other_content_is_a_conflict(signed_client, document_envelope):
    """Fails if one idempotency key can be reused to issue a different document."""
    envelope = document_envelope()
    signed_client.post(CREATE, envelope)

    response = signed_client.post(CREATE, {**envelope, 'number': 990_000_002})

    assert response.status_code == 409
    assert response.json()['error']['code'] == 'idempotency_conflict'


@pytest.mark.django_db
def test_repeated_number_is_a_conflict(signed_client, document_envelope):
    """Fails if two different documents can carry the same number (DIAN regla 90)."""
    signed_client.post(CREATE, document_envelope())

    response = signed_client.post(CREATE, document_envelope(idempotency_key='waiter:org-1:doc-2'))

    assert response.json()['error']['code'] == 'duplicate_number'


@pytest.mark.django_db
def test_number_outside_the_ranges_is_refused(signed_client, document_envelope):
    """Fails if a number outside the issuer's authorized range is accepted."""
    response = signed_client.post(CREATE, document_envelope(number=1))

    assert response.json()['error']['code'] == 'number_out_of_range'


@pytest.mark.django_db
def test_issuer_without_certificate_cannot_issue(signed_client, issuer, invoice_range, document_envelope):
    """Fails if a document is queued for an issuer that has no valid certificate to sign it."""
    issuer.certificates.update(active=False)

    response = signed_client.post(CREATE, document_envelope())

    assert response.status_code == 409
    assert response.json()['error']['code'] == 'issuer_not_ready'


@pytest.mark.django_db
def test_invalid_document_lists_every_problem(signed_client, document_envelope):
    """Fails if an invalid document is refused without the list of problems and their DIAN rules."""
    bill = restaurant_bill()
    bill['totals']['payable'] = '1.00'

    response = signed_client.post(CREATE, document_envelope(document=bill))

    error = response.json()['error']
    assert error['code'] == 'invalid_document'
    assert {'path': 'totals.payable', 'code': 'payable_mismatch', 'rule': 'FAU14'}.items() <= error['problems'][0].items()


@pytest.mark.django_db
@freeze_time('2026-10-04 15:00:00')
def test_future_issue_datetime_is_refused(signed_client, document_envelope):
    """Fails if a document dated in the future is accepted."""
    later = (timezone.now() + timedelta(hours=1)).isoformat()

    response = signed_client.post(CREATE, document_envelope(issue_datetime=later))

    assert response.json()['error']['code'] == 'issue_datetime_in_future'


@pytest.mark.django_db
@freeze_time('2026-10-04 15:00:00')
def test_old_document_outside_contingency_is_refused(signed_client, document_envelope):
    """Fails if a document from two days ago passes as a normal one (issue date must be the signing date, FAD09e)."""
    old = (timezone.now() - timedelta(days=2)).isoformat()

    response = signed_client.post(CREATE, document_envelope(issue_datetime=old))

    assert response.json()['error']['code'] == 'issue_datetime_too_old'


@pytest.mark.django_db
def test_other_client_cannot_read_the_document(signed_client, other_signed_client, document_envelope):
    """Fails if a client system can read another client's document by its id."""
    document_id = signed_client.post(CREATE, document_envelope()).json()['id']

    response = other_signed_client.get(f'/api/v1/documents/{document_id}/')

    assert response.status_code == 404


@pytest.mark.django_db
def test_other_client_cannot_issue_for_the_issuer(other_signed_client, document_envelope):
    """Fails if a client system can issue with a business registered by another client."""
    response = other_signed_client.post(CREATE, document_envelope())

    assert response.json()['error']['code'] == 'issuer_not_found'


@pytest.mark.django_db
def test_credit_note_is_linked_to_its_invoice(signed_client, document_envelope):
    """Fails if a credit note referencing a Fiscal. invoice is not linked to it."""
    invoice_id = signed_client.post(CREATE, document_envelope()).json()['id']
    note = restaurant_bill()
    note['billing_reference'] = {'document_id': invoice_id, 'concept_code': '2', 'reason': 'Anulación'}

    response = signed_client.post(
        CREATE, document_envelope(idempotency_key='waiter:nc-1', kind='credit_note', prefix='NC', number=1, document=note)
    )

    assert response.status_code == 202
    assert response.json()['original'] == invoice_id


@pytest.mark.django_db
def test_credit_note_for_an_unknown_invoice_is_refused(signed_client, document_envelope):
    """Fails if a credit note can reference an invoice that does not exist for the issuer."""
    note = restaurant_bill()
    note['billing_reference'] = {'document_id': 999999, 'concept_code': '2'}

    response = signed_client.post(
        CREATE, document_envelope(idempotency_key='waiter:nc-1', kind='credit_note', prefix='NC', number=1, document=note)
    )

    assert response.json()['error']['problems'][0]['code'] == 'original_not_found'


@pytest.mark.django_db
def test_credit_note_in_issuer_contingency_is_refused(signed_client, document_envelope):
    """Fails if a note is accepted as issuer contingency: notes have no contingency scheme (annex §12.1)."""
    invoice_id = signed_client.post(CREATE, document_envelope()).json()['id']
    note = restaurant_bill()
    note['billing_reference'] = {'document_id': invoice_id, 'concept_code': '2'}
    note['issuer_contingency'] = True

    response = signed_client.post(
        CREATE, document_envelope(idempotency_key='waiter:nc-1', kind='credit_note', prefix='NC', number=1, document=note)
    )

    assert response.status_code == 400
    assert response.json()['error']['code'] == 'contingency_not_allowed'

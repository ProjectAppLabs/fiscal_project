"""Tests for support from the console: document filters and exports, actions on a document, alerts and health."""

from datetime import UTC, datetime
from unittest import mock

import pytest
from freezegun import freeze_time

from dian import soap
from fiscal_app.models import Alert, DocumentEvent
from fiscal_app.models.choices import DocumentState


@pytest.fixture
def two_documents(make_document):
    invoice = make_document(idempotency_key='waiter:1', number=990_000_001, issue_datetime=datetime(2026, 10, 14, 4, 30, tzinfo=UTC),
                            cufe='abc123', state=DocumentState.VALIDATED)
    note = make_document(idempotency_key='waiter:2', kind='credit_note', prefix='NC', number=7, original=invoice,
                         issue_datetime=datetime(2026, 10, 14, 15, 0, tzinfo=UTC))
    return invoice, note


@pytest.mark.django_db
def test_documents_filter_by_kind(authenticated_client, two_documents):
    """Fails if the list cannot show only the credit notes."""
    response = authenticated_client.get('/api/console/documents/?kind=credit_note')

    assert [row['full_number'] for row in response.json()['results']] == ['NC7']


@pytest.mark.django_db
def test_documents_filter_by_colombian_day(authenticated_client, two_documents):
    """Fails if an invoice issued at 23:30 of the 13th in Colombia (04:30 UTC of the 14th) counts as the 14th."""
    response = authenticated_client.get('/api/console/documents/?date_from=2026-10-13&date_to=2026-10-13')

    assert [row['full_number'] for row in response.json()['results']] == ['SETP990000001']


@pytest.mark.django_db
def test_documents_search_by_full_number(authenticated_client, two_documents):
    """Fails if typing the number as printed on the invoice does not find it."""
    response = authenticated_client.get('/api/console/documents/?q=SETP990000001')

    assert [row['full_number'] for row in response.json()['results']] == ['SETP990000001']


@pytest.mark.django_db
def test_documents_search_by_cufe(authenticated_client, two_documents):
    """Fails if the start of a CUFE does not find its document."""
    response = authenticated_client.get('/api/console/documents/?q=ABC1')

    assert [row['full_number'] for row in response.json()['results']] == ['SETP990000001']


@pytest.mark.django_db
def test_invoice_detail_lists_its_notes(authenticated_client, two_documents):
    """Fails if an invoice does not show the notes that correct it."""
    invoice, _note = two_documents

    response = authenticated_client.get(f'/api/console/documents/{invoice.pk}/')

    assert [note['full_number'] for note in response.json()['notes']] == ['NC7']


@pytest.mark.django_db
def test_export_neutralizes_spreadsheet_formulas(authenticated_client, make_document, issuer):
    """Fails if a value that starts with = reaches the CSV as a formula Excel would run."""
    issuer.legal_name = '=HYPERLINK("http://evil")'
    issuer.save(update_fields=['legal_name'])
    make_document()

    response = authenticated_client.get('/api/console/documents/export/')

    assert '\'=HYPERLINK' in response.content.decode('utf-8-sig')


@pytest.mark.django_db
@freeze_time('2026-10-14 12:00:00')
def test_transmit_now_moves_a_queued_document_ahead(authenticated_client, make_document):
    """Fails if «Transmitir ahora» does not put a queued document first in line and leave a trace in its history."""
    document = make_document(next_attempt_at=datetime(2026, 10, 14, 18, 0, tzinfo=UTC))

    with mock.patch('fiscal_app.services.documents._schedule_transmission'):
        authenticated_client.post(f'/api/console/documents/{document.pk}/actions/transmit/', {}, format='json')

    document.refresh_from_db()
    assert document.next_attempt_at == datetime(2026, 10, 14, 12, 0, tzinfo=UTC)
    assert 'Transmisión pedida desde la consola' in DocumentEvent.objects.filter(document=document).last().detail['text']


@pytest.mark.django_db
def test_validated_document_is_not_transmitted_again(authenticated_client, make_document):
    """Fails if a document the DIAN already validated can be sent again (it would be rule 90)."""
    document = make_document(state=DocumentState.VALIDATED)

    response = authenticated_client.post(f'/api/console/documents/{document.pk}/actions/transmit/', {}, format='json')

    assert (response.status_code, response.json()['code']) == (409, 'not_transmittable')


@pytest.mark.django_db
def test_dian_status_needs_the_real_gateway(authenticated_client, make_document):
    """Fails if «Consultar a la DIAN» pretends to ask with the simulated gateway."""
    document = make_document(cufe='abc123')

    response = authenticated_client.post(f'/api/console/documents/{document.pk}/actions/check-dian/', {}, format='json')

    assert response.json()['code'] == 'dian_unavailable'


@pytest.mark.django_db
def test_dian_status_reports_what_the_dian_says(authenticated_client, make_document, ready_issuer, settings):
    """Fails if asking the DIAN does not return its answer for the document's CUFE."""
    settings.DIAN_GATEWAY = 'soap'
    document = make_document(cufe='abc123')
    answer = soap.DianResponse(is_valid=True, status_code='00', status_description='Procesado Correctamente.', status_message='')

    with mock.patch('fiscal_app.services.support.soap.DianClient') as client:
        client.return_value.get_status.return_value = answer
        response = authenticated_client.post(f'/api/console/documents/{document.pk}/actions/check-dian/', {}, format='json')

    assert (response.json()['status_description'], client.return_value.get_status.call_args.args) == ('Procesado Correctamente.', ('abc123',))


@pytest.mark.django_db
def test_notice_needs_a_webhook(authenticated_client, make_document):
    """Fails if resending a notice is attempted for a client system without notice URL."""
    document = make_document()

    response = authenticated_client.post(f'/api/console/documents/{document.pk}/actions/resend-notice/', {}, format='json')

    assert response.json()['code'] == 'no_webhook'


@pytest.mark.django_db
def test_alerts_filter_by_severity(authenticated_client, issuer):
    """Fails if the alert list cannot show only the critical ones."""
    Alert.objects.create(kind=Alert.Kind.RANGE_LOW, key='a', message='Rango', issuer=issuer)
    Alert.objects.create(kind=Alert.Kind.REJECTION, key='b', message='Rechazo', issuer=issuer, severity=Alert.Severity.CRITICAL)

    response = authenticated_client.get('/api/console/alerts/?severity=critical')

    assert [row['message'] for row in response.json()['results']] == ['Rechazo']


@pytest.mark.django_db
def test_bulk_resolution_keeps_who_and_why(authenticated_client, existing_user, issuer):
    """Fails if resolving several alerts does not record the operator and the note."""
    first = Alert.objects.create(kind=Alert.Kind.RANGE_LOW, key='a', message='Rango', issuer=issuer)
    second = Alert.objects.create(kind=Alert.Kind.RESOLUTION_EXPIRING, key='b', message='Resolución', issuer=issuer)

    authenticated_client.post('/api/console/alerts/resolve/', {'ids': [first.pk, second.pk], 'note': 'Rango nuevo cargado'}, format='json')

    assert set(Alert.objects.values_list('resolved_by_id', 'resolution_note')) == {(existing_user.pk, 'Rango nuevo cargado')}


@pytest.mark.django_db
def test_health_counts_what_waits(authenticated_client, make_document):
    """Fails if the health page does not say how many documents wait in the queue."""
    make_document(state=DocumentState.QUEUED)

    response = authenticated_client.get('/api/console/health/')

    assert response.json()['documents']['queued'] == 1

"""Tests for the F5 console API: issuers, alerts, contingencies, client systems, artifacts and the wider summary."""

from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from fiscal_app.models import Alert, Document, DocumentEvent, SoftwareRegistration
from fiscal_app.models.choices import ArtifactKind, DocumentState
from fiscal_app.services import artifacts
from fiscal_app.services.alerts import raise_alert

ENDPOINTS = [
    '/api/console/issuers/', '/api/console/alerts/', '/api/console/contingencies/', '/api/console/client-systems/',
]


@pytest.mark.django_db
@pytest.mark.parametrize('path', ENDPOINTS)
def test_console_endpoints_require_an_operator(api_client, path):
    """Fails if a console list can be read without an operator session."""
    assert api_client.get(path).status_code == 401


@pytest.mark.django_db
def test_issuer_list_shows_certificate_expiry_and_open_alerts(authenticated_client, ready_issuer):
    """Fails if the issuer list hides when the certificate expires or how many alerts are open."""
    raise_alert(Alert.Kind.RANGE_LOW, 'range:1:low', 'Quedan pocos números', issuer=ready_issuer)

    (row,) = authenticated_client.get('/api/console/issuers/').json()['results']

    assert (row['nit'], row['open_alerts']) == (ready_issuer.nit, 1)
    assert row['certificate_expires'] is not None


@pytest.mark.django_db
def test_issuer_list_filters_by_nit_or_name(authenticated_client, ready_issuer):
    """Fails if the search box does not narrow the issuers by NIT prefix or name."""
    assert authenticated_client.get('/api/console/issuers/?q=999').json()['count'] == 0
    assert authenticated_client.get(f'/api/console/issuers/?q={ready_issuer.nit[:4]}').json()['count'] == 1


@pytest.mark.django_db
def test_issuer_detail_never_exposes_secrets(authenticated_client, ready_issuer, invoice_range):
    """Fails if the issuer detail leaks the .p12, its password, the software PIN or the technical key."""
    response = authenticated_client.get(f'/api/console/issuers/{ready_issuer.pk}/')

    text = response.content.decode()
    certificate = ready_issuer.certificates.get()
    assert response.status_code == 200
    for secret in (certificate.p12[:40], 'clave', invoice_range.technical_key):
        assert secret not in text
    assert 'software_pin' not in text and 'technical_key' not in text


@pytest.mark.django_db
def test_issuer_detail_shows_range_usage(authenticated_client, ready_issuer, invoice_range, make_document):
    """Fails if a range does not report its last number and how much of it is used."""
    invoice_range.number_from, invoice_range.number_to = 1, 100
    invoice_range.save()
    make_document(number=25)

    (numbering,) = authenticated_client.get(f'/api/console/issuers/{ready_issuer.pk}/').json()['ranges']

    assert (numbering['last_number'], numbering['used_share']) == (25, 0.25)


@pytest.mark.django_db
def test_issuer_detail_lists_software_without_pin(authenticated_client, ready_issuer):
    """Fails if the registered software is missing from the detail or carries its PIN."""
    (software,) = authenticated_client.get(f'/api/console/issuers/{ready_issuer.pk}/').json()['software']

    registration = SoftwareRegistration.objects.get(issuer=ready_issuer)
    assert software['software_id'] == registration.software_id
    assert set(software) == {'environment', 'software_id', 'has_test_set', 'active', 'created_at'}


@pytest.mark.django_db
@freeze_time('2026-10-05 12:00:00')
def test_alerts_list_shows_open_ones_by_default(authenticated_client, issuer):
    """Fails if resolved alerts clutter the default alert list."""
    raise_alert(Alert.Kind.REJECTION, 'rejection:1', 'Rechazo', issuer=issuer)
    resolved = raise_alert(Alert.Kind.RANGE_LOW, 'range:1:low', 'Pocos números', issuer=issuer)
    Alert.objects.filter(pk=resolved.pk).update(resolved_at=timezone.now())

    open_rows = authenticated_client.get('/api/console/alerts/').json()['results']
    all_rows = authenticated_client.get('/api/console/alerts/?state=all').json()['results']

    assert [row['kind'] for row in open_rows] == ['rejection']
    assert len(all_rows) == 2


@pytest.mark.django_db
def test_operator_resolves_an_alert(authenticated_client, issuer):
    """Fails if an operator cannot close an alert (rejections are only closed by hand)."""
    alert = raise_alert(Alert.Kind.REJECTION, 'rejection:1', 'Rechazo', issuer=issuer)

    response = authenticated_client.post(f'/api/console/alerts/{alert.pk}/resolve/')

    assert response.json()['resolved_at'] is not None
    assert authenticated_client.get('/api/console/alerts/').json()['count'] == 0


@pytest.mark.django_db
@freeze_time('2026-10-05 12:00:00')
def test_contingencies_list_the_48_hour_clock(authenticated_client, make_document):
    """Fails if an invoice in contingency is missing or its 48-hour deadline is wrong; normal ones must not appear."""
    started = timezone.now() - timedelta(hours=30)
    in_dian = make_document(state=DocumentState.CONTINGENCY_DIAN, contingency_started_at=started, invoice_type='04')
    make_document(idempotency_key='waiter:normal', number=990_000_009)

    (row,) = authenticated_client.get('/api/console/contingencies/').json()['results']

    assert (row['id'], row['contingency'], row['invoice_type']) == (in_dian.pk, 'dian', '04')
    assert row['hours_left'] == 18.0


@pytest.mark.django_db
@freeze_time('2026-10-05 12:00:00')
def test_paper_invoices_appear_as_issuer_contingency(authenticated_client, make_document):
    """Fails if a transcribed paper invoice waiting for the DIAN is not on the contingency board."""
    make_document(payload={'issuer_contingency': True, 'totals': {}})

    (row,) = authenticated_client.get('/api/console/contingencies/').json()['results']

    assert row['contingency'] == 'issuer'


@pytest.mark.django_db
def test_client_systems_show_notice_health_without_secrets(authenticated_client, client_system, queued_document):
    """Fails if the client list hides failed notices or exposes a secret."""
    client, secret = client_system
    client.webhook_deliveries.create(document=queued_document, payload={}, next_attempt_at=None)

    response = authenticated_client.get('/api/console/client-systems/')

    (row,) = response.json()['results']
    assert (row['valid_secrets'], row['failed_notices'], row['pending_notices']) == (1, 1, 0)
    assert secret not in response.content.decode()


@pytest.mark.django_db
def test_operator_downloads_an_artifact(authenticated_client, queued_document):
    """Fails if the console cannot hand over a stored artifact with its SHA-256."""
    stored = artifacts.store(queued_document, ArtifactKind.PDF, b'%PDF-1.4 prueba', 'application/pdf')

    response = authenticated_client.get(f'/api/console/documents/{queued_document.pk}/artifacts/pdf/')

    assert response.status_code == 200
    assert response.content == b'%PDF-1.4 prueba'
    assert response['X-Fiscal-SHA256'] == stored.sha256


@pytest.mark.django_db
def test_tampered_artifact_is_not_served(authenticated_client, queued_document, artifacts_dir):
    """Fails if a file altered on disk is handed out as if it were the original."""
    stored = artifacts.store(queued_document, ArtifactKind.PDF, b'%PDF original', 'application/pdf')
    (artifacts_dir / stored.storage_path).write_bytes(b'%PDF alterado')

    response = authenticated_client.get(f'/api/console/documents/{queued_document.pk}/artifacts/pdf/')

    assert (response.status_code, response.json()['code']) == (503, 'artifact_unavailable')


@pytest.mark.django_db
def test_missing_artifact_is_not_found(authenticated_client, queued_document):
    """Fails if asking for an artifact the document does not have does not answer 404."""
    response = authenticated_client.get(f'/api/console/documents/{queued_document.pk}/artifacts/attached_document/')

    assert response.status_code == 404


@pytest.mark.django_db
@freeze_time('2026-10-05 12:00:00')
def test_summary_reports_alerts_rejection_rate_and_health(authenticated_client, issuer, queued_document):
    """Fails if the dashboard summary lacks open alerts, the 24-hour rejection rate or the service health."""
    raise_alert(Alert.Kind.REJECTION, 'rejection:1', 'Rechazo', severity=Alert.Severity.CRITICAL, issuer=issuer)
    for state in (DocumentState.VALIDATED, DocumentState.VALIDATED, DocumentState.VALIDATED, DocumentState.REJECTED):
        DocumentEvent.objects.create(document=queued_document, state=state, detail={})

    data = authenticated_client.get('/api/console/summary/').json()

    assert data['alerts'] == {'total': 1, 'critical': 1}
    assert data['rejection_rate_24h'] == 0.25
    assert data['health']['database'] == 'ok'


@pytest.mark.django_db
def test_document_detail_says_its_invoice_type(authenticated_client, queued_document):
    """Fails if the console detail hides whether the invoice went as type 01, 03 or 04."""
    Document.objects.filter(pk=queued_document.pk).update(invoice_type='04')

    data = authenticated_client.get(f'/api/console/documents/{queued_document.pk}/').json()

    assert data['invoice_type'] == '04'

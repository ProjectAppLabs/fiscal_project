"""Tests for alerts (certificate, numbering, resolution, contingency deadlines, rejections, queue) and api/health/."""

from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from freezegun import freeze_time

from dian.gateway import DianGateway, GatewayResult
from fiscal_app.models import Alert, Certificate, Document
from fiscal_app.models.choices import DocumentState
from fiscal_app.services import alerts, health
from fiscal_app.services.emission import transmit


def open_alerts(kind):
    return list(Alert.objects.filter(kind=kind, resolved_at__isnull=True))


def certificate_of(issuer):
    return Certificate.objects.get(issuer=issuer, active=True)


@pytest.mark.django_db
def test_certificate_alert_tightens_as_expiry_approaches(ready_issuer):
    """Fails if the certificate alert is not raised at 30 days and replaced by a critical one at 7 days."""
    expires = certificate_of(ready_issuer).not_after

    alerts.check_all(now=expires - timedelta(days=20))
    alerts.check_all(now=expires - timedelta(days=6))

    (alert,) = open_alerts(Alert.Kind.CERTIFICATE_EXPIRING)
    assert alert.key.endswith(':7')
    assert alert.severity == Alert.Severity.CRITICAL
    assert Alert.objects.filter(kind=Alert.Kind.CERTIFICATE_EXPIRING).count() == 2


@pytest.mark.django_db
def test_replaced_certificate_clears_its_alert(ready_issuer):
    """Fails if an alert stays open after the business uploads a new certificate."""
    expires = certificate_of(ready_issuer).not_after
    alerts.check_all(now=expires - timedelta(days=20))
    Certificate.objects.filter(issuer=ready_issuer).update(active=False)

    alerts.check_all(now=expires - timedelta(days=19))

    assert open_alerts(Alert.Kind.CERTIFICATE_EXPIRING) == []


@pytest.mark.django_db
def test_the_same_condition_alerts_once(ready_issuer):
    """Fails if a periodic check repeats an alert (and its e-mails) every 15 minutes."""
    expires = certificate_of(ready_issuer).not_after

    first = alerts.check_all(now=expires - timedelta(days=20))
    second = alerts.check_all(now=expires - timedelta(days=20))

    assert (first, second) == (1, 0)


@pytest.mark.django_db
@freeze_time('2026-10-05 12:00:00')
def test_almost_used_range_is_reported(ready_issuer, invoice_range, make_document):
    """Fails if a range with less than 10 % of its numbers left does not warn the business."""
    invoice_range.number_from, invoice_range.number_to = 1, 100
    invoice_range.prefix = 'SETP'
    invoice_range.save()
    make_document(number=95)

    alerts.check_all(now=timezone.now())

    (alert,) = open_alerts(Alert.Kind.RANGE_LOW)
    assert 'le quedan 5 números' in alert.message


@pytest.mark.django_db
@freeze_time('2026-10-05 12:00:00')
def test_resolution_about_to_expire_is_reported(ready_issuer, invoice_range):
    """Fails if a numbering resolution 30 days from expiring raises no alert."""
    now = timezone.now()
    invoice_range.valid_to = timezone.localdate(now) + timedelta(days=20)
    invoice_range.save()

    alerts.check_all(now=now)

    (alert,) = open_alerts(Alert.Kind.RESOLUTION_EXPIRING)
    assert alert.issuer == ready_issuer


@pytest.mark.django_db
@freeze_time('2026-10-05 12:00:00')
def test_dian_contingency_warns_at_24_and_40_hours(queued_document):
    """Fails if an invoice in DIAN contingency does not warn at 24 h and critically at 40 h of the 48 h deadline."""
    started = timezone.now()
    Document.objects.filter(pk=queued_document.pk).update(state=DocumentState.CONTINGENCY_DIAN, contingency_started_at=started)

    alerts.check_all(now=started + timedelta(hours=25))
    alerts.check_all(now=started + timedelta(hours=41))

    (alert,) = open_alerts(Alert.Kind.CONTINGENCY_DEADLINE)
    assert (alert.key, alert.severity) == (f'contingency:{queued_document.pk}:40', Alert.Severity.CRITICAL)


@pytest.mark.django_db
def test_paper_invoice_deadline_counts_from_reception(queued_document):
    """Fails if a paper invoice (type 03) waiting more than 24 h since Fiscal. received it raises no alert."""
    queued_document.payload = {**queued_document.payload, 'issuer_contingency': True}
    queued_document.save()

    alerts.check_all(now=queued_document.created_at + timedelta(hours=25))

    assert [alert.document for alert in open_alerts(Alert.Kind.CONTINGENCY_DEADLINE)] == [queued_document]


@pytest.mark.django_db
@freeze_time('2026-10-05 12:00:00')
def test_transmitted_contingency_clears_its_alert(queued_document):
    """Fails if a contingency alert stays open after the invoice is validated."""
    started = timezone.now()
    Document.objects.filter(pk=queued_document.pk).update(state=DocumentState.CONTINGENCY_DIAN, contingency_started_at=started)
    alerts.check_all(now=started + timedelta(hours=25))
    Document.objects.filter(pk=queued_document.pk).update(state=DocumentState.VALIDATED)

    alerts.check_all(now=started + timedelta(hours=26))

    assert open_alerts(Alert.Kind.CONTINGENCY_DEADLINE) == []


@pytest.mark.django_db
def test_stuck_queue_alerts_projectapp(queued_document):
    """Fails if documents waiting more than 15 minutes (a dead worker) raise no alert, or it never clears."""
    now = queued_document.next_attempt_at + timedelta(minutes=16)

    alerts.check_all(now=now)
    (alert,) = open_alerts(Alert.Kind.QUEUE_STUCK)
    Document.objects.filter(pk=queued_document.pk).update(state=DocumentState.VALIDATED)
    alerts.check_all(now=now)

    assert alert.issuer is None
    assert open_alerts(Alert.Kind.QUEUE_STUCK) == []


class Rejecting(DianGateway):
    def send(self, submission):
        return GatewayResult(state='rejected', errors=[{'rule': 'FAJ43b', 'severity': 'rechazo', 'message': 'Nombre'}])


@pytest.mark.django_db
def test_rejection_alerts_with_its_rules(queued_document):
    """Fails if a DIAN rejection does not raise a critical alert naming the failed rules."""
    transmit(queued_document.pk, Rejecting())

    (alert,) = open_alerts(Alert.Kind.REJECTION)
    assert alert.severity == Alert.Severity.CRITICAL
    assert 'FAJ43b' in alert.message


@pytest.mark.django_db
def test_issuer_alert_reaches_projectapp_and_the_client_system(ready_issuer, settings):
    """Fails if an issuer alert is not e-mailed to ProjectApp and sent as a signed notice to the client system."""
    settings.FISCAL_ALERT_EMAILS = ['operacion@projectapp.co']
    ready_issuer.client.webhook_url = 'https://waiter.local/fiscal/avisos/'
    ready_issuer.client.save()

    alerts.check_all(now=certificate_of(ready_issuer).not_after - timedelta(days=20))

    (notice,) = ready_issuer.client.webhook_deliveries.all()
    assert notice.payload['event'] == 'issuer.alert'
    assert notice.payload['alert']['kind'] == Alert.Kind.CERTIFICATE_EXPIRING
    assert [message.to for message in mail.outbox] == [['operacion@projectapp.co']]


@pytest.mark.django_db
@freeze_time('2026-10-05 12:00:00')
def test_health_is_degraded_when_the_worker_is_silent():
    """Fails if api/health/ reports ok while no worker has beaten in the last three minutes."""
    now = timezone.now()
    health.beat(now=now - timedelta(minutes=5))

    data, status = health.report(now=now)

    assert (status, data['status'], data['worker']['ok']) == (200, 'degraded', False)


@pytest.mark.django_db
def test_health_reports_documents_in_dian_contingency(queued_document):
    """Fails if api/health/ hides that documents are waiting for the DIAN."""
    Document.objects.filter(pk=queued_document.pk).update(state=DocumentState.CONTINGENCY_DIAN)
    health.beat()

    data, _status = health.report()

    assert (data['status'], data['dian']['in_contingency']) == ('degraded', 1)


@pytest.mark.django_db
def test_health_is_ok_with_a_live_worker_and_empty_queue():
    """Fails if a healthy installation is reported as degraded."""
    health.beat()

    data, status = health.report()

    assert (status, data['status'], data['queue']['due']) == (200, 'ok', 0)


def test_thresholds_are_the_ones_of_the_inventory():
    """Fails if the alert thresholds drift from the operation inventory (30/15/7 days, 10 %, 30 days, 24/40 h)."""
    assert alerts.CERTIFICATE_DAYS == (7, 15, 30)
    assert alerts.RANGE_LOW_SHARE == 0.10
    assert alerts.RESOLUTION_DAYS == 30
    assert alerts.CONTINGENCY_HOURS == (24, 40)

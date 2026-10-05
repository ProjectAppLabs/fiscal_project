"""Tests for the transmission queue (emission service) with the simulated and fake DIAN gateways."""

from datetime import timedelta

import pytest
from dian.gateway import DianGateway, DianUnavailable, GatewayResult
from django.utils import timezone
from freezegun import freeze_time

from fiscal_app.models import Document
from fiscal_app.models.choices import DocumentState
from fiscal_app.services.emission import claim_due, run_once, transmit


class Unavailable(DianGateway):
    """DIAN that never answers usefully ('error' or 'delay', annex §12.4)."""

    def __init__(self, kind='error'):
        """Choose the kind of unavailability."""
        self.kind = kind

    def send(self, submission):
        """Raise the unavailability."""
        raise DianUnavailable('sin respuesta', self.kind)


class Rejecting(DianGateway):
    """DIAN that rejects every document with rule FAD06."""

    def send(self, submission):
        """Return a rejection."""
        return GatewayResult(state='rejected', errors=[{'rule': 'FAD06', 'message': 'Regla incumplida'}])


class Exploding(DianGateway):
    """Gateway that fails with an unexpected error."""

    def send(self, submission):
        """Raise an unexpected error."""
        raise RuntimeError('fallo inesperado')


def claim_and_transmit(document, gateway=None):
    """Claim the due documents and transmit the given one, as a worker would."""
    claim_due()
    return transmit(document.pk, gateway)


@pytest.mark.django_db
def test_claim_leases_due_documents_once(queued_document):
    """Fails if a due document can be claimed twice, so two workers would transmit it."""
    assert claim_due() == [queued_document.pk]
    assert claim_due() == []


@pytest.mark.django_db
def test_simulated_dian_validates_a_testing_document(queued_document):
    """Fails if a testing document does not end validated with its CUFE, QR and stored proof."""
    document = claim_and_transmit(queued_document)

    assert document.state == DocumentState.VALIDATED
    assert len(document.cufe) == 96
    assert document.qr_url.startswith('https://catalogo-vpfe-hab.dian.gov.co/')
    assert set(document.artifacts.values_list('kind', flat=True)) == {'signed_xml', 'dian_response'}


@pytest.mark.django_db
def test_simulated_dian_never_validates_production(queued_document, ready_issuer):
    """Fails if the simulator marks a production document as validated."""
    ready_issuer.environment = '1'
    ready_issuer.save()

    document = claim_and_transmit(queued_document)

    assert document.state == DocumentState.QUEUED
    assert document.cufe == ''


@pytest.mark.django_db
def test_rejection_keeps_the_dian_rules(queued_document):
    """Fails if a DIAN rejection does not keep the broken rules to show the business."""
    document = claim_and_transmit(queued_document, Rejecting())

    assert document.state == DocumentState.REJECTED
    assert document.errors[0]['rule'] == 'FAD06'


@pytest.mark.django_db
def test_service_error_is_retried_after_five_seconds(queued_document):
    """Fails if a DIAN service error is not retried 5 s later, as the annex §12.4 says."""
    with freeze_time('2026-10-04 15:00:00'):
        document = claim_and_transmit(queued_document, Unavailable('error'))

        assert document.state == DocumentState.QUEUED
        assert document.next_attempt_at == timezone.now() + timedelta(seconds=5)


@pytest.mark.django_db
def test_delay_is_retried_after_two_minutes(queued_document):
    """Fails if a DIAN timeout is not retried 2 minutes later, as the annex §12.4 says."""
    with freeze_time('2026-10-04 15:00:00'):
        document = claim_and_transmit(queued_document, Unavailable('delay'))

        assert document.next_attempt_at == timezone.now() + timedelta(minutes=2)


@pytest.mark.django_db
def test_fourth_service_error_enters_dian_contingency(queued_document):
    """Fails if a document is not put in DIAN contingency (type 04) after the three retries of the annex."""
    Document.objects.filter(pk=queued_document.pk).update(transient_failures=3)

    document = claim_and_transmit(queued_document, Unavailable('error'))

    assert document.state == DocumentState.CONTINGENCY_DIAN
    assert document.events.filter(state=DocumentState.CONTINGENCY_DIAN).count() == 1


@pytest.mark.django_db
def test_consecutive_errors_are_counted_until_contingency(queued_document):
    """Fails if the failure count is not saved between attempts, so a document never reaches contingency."""
    for _ in range(4):
        Document.objects.filter(pk=queued_document.pk).update(state=DocumentState.TRANSMITTING)
        document = transmit(queued_document.pk, Unavailable('error'))

    assert document.state == DocumentState.CONTINGENCY_DIAN
    assert Document.objects.get(pk=queued_document.pk).transient_failures == 4


@pytest.mark.django_db
@freeze_time('2026-10-04 15:00:00')
def test_contingency_polls_stay_quiet(queued_document):
    """Fails if every 30-minute poll during a DIAN outage adds another event and another notice."""
    Document.objects.filter(pk=queued_document.pk).update(
        state=DocumentState.CONTINGENCY_DIAN, transient_failures=4, next_attempt_at=timezone.now()
    )

    document = claim_and_transmit(queued_document, Unavailable('error'))

    assert document.state == DocumentState.CONTINGENCY_DIAN
    assert not document.events.exists()


@pytest.mark.django_db
@freeze_time('2026-10-04 15:00:00')
def test_number_never_changes_across_retries(queued_document):
    """Fails if retries change the document number (the DIAN validates each number once, regla 90)."""
    claim_and_transmit(queued_document, Unavailable('error'))
    Document.objects.filter(pk=queued_document.pk).update(next_attempt_at=timezone.now())

    document = claim_and_transmit(queued_document)

    assert document.state == DocumentState.VALIDATED
    assert document.full_number == 'SETP990000001'
    assert document.transient_failures == 0


@pytest.mark.django_db
@freeze_time('2026-10-04 15:00:00')
def test_note_waits_for_its_invoice(queued_document, make_document):
    """Fails if a credit note is sent before the invoice it corrects has its CUFE."""
    Document.objects.filter(pk=queued_document.pk).update(next_attempt_at=timezone.now() + timedelta(hours=1))
    note = make_document(
        idempotency_key='waiter:nc-1', kind='credit_note', prefix='NC', number=1, original=queued_document,
        numbering_range=None, next_attempt_at=timezone.now(),
    )

    document = claim_and_transmit(note)

    assert document.state == DocumentState.QUEUED
    assert document.attempts == 0


@pytest.mark.django_db
def test_stuck_transmission_is_rescued(queued_document):
    """Fails if a document stays 'transmitting' forever after a worker dies mid-way."""
    claim_due()

    with freeze_time(timezone.now() + timedelta(minutes=11)):
        assert claim_due() == [queued_document.pk]


@pytest.mark.django_db
def test_unexpected_error_leaves_the_worker_running(queued_document):
    """Fails if one document with an unexpected error stops the worker from processing the rest."""
    assert run_once(gateway=Exploding()) == 1


@pytest.mark.django_db
def test_validation_queues_a_notice_for_the_client(queued_document, client_system):
    """Fails if the client system is not notified when its document is validated."""
    client, _secret = client_system
    client.webhook_url = 'https://waiter.test/internal/fiscal/events'
    client.save()

    document = claim_and_transmit(queued_document)

    assert document.webhook_deliveries.count() == 1


@pytest.mark.mysql
@pytest.mark.django_db(transaction=True)
def test_locked_document_is_skipped_by_another_worker(queued_document):
    """Fails if a second worker waits for, or takes, a document another worker has locked (skip_locked)."""
    import threading

    from django.db import connection, transaction

    locked = threading.Event()
    release = threading.Event()

    def other_worker():
        with transaction.atomic():
            Document.objects.select_for_update().get(pk=queued_document.pk)
            locked.set()
            release.wait(5)
        connection.close()

    thread = threading.Thread(target=other_worker)
    thread.start()
    locked.wait(5)
    try:
        assert claim_due() == []
    finally:
        release.set()
        thread.join()

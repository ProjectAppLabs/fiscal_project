"""Transmission queue: takes due documents, sends them through the DIAN gateway and records the outcome.

The database is the source of truth: a document's state and next attempt live in its row; Huey only runs the work.
A document's number, CUFE and signed XML never change on retries (DIAN regla 90).

Retries follow the annex FE 1.9 §12.4: an 'error' answer is retried every 5 s three times, a 'delay' (timeout) every
2 minutes five times; after that the document enters DIAN contingency (type 04), which F4 completes (re-signing as
04, delivery without validation and the 48-hour transmission). The DIAN service is then polled every 30 minutes.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from dian.gateway import DianUnavailable, GatewayRefused, Submission
from fiscal_app.models import Document, DocumentEvent
from fiscal_app.models.choices import ArtifactKind, DocumentKind, DocumentState
from fiscal_app.services import artifacts, webhooks
from fiscal_app.services.gateways import get_gateway

logger = logging.getLogger(__name__)
RETRY_POLICY = {'error': (timedelta(seconds=5), 3), 'delay': (timedelta(minutes=2), 5)}
CONTINGENCY_POLL = timedelta(minutes=30)
REFUSED_RETRY = timedelta(hours=1)
WAIT_FOR_ORIGINAL = timedelta(minutes=1)
STUCK_AFTER = timedelta(minutes=10)
READY_ORIGINAL_STATES = (DocumentState.VALIDATED, DocumentState.CONTINGENCY_DIAN)


def claim_due(batch: int = 20, now=None) -> list[int]:
    """Lease due documents to this worker and return their ids; rows locked by another worker are skipped.

    Queued documents move to `transmitting`. Documents in DIAN contingency keep their state (they may already have
    been delivered as type 04) and are leased by pushing their next attempt STUCK_AFTER ahead.
    """
    now = now or timezone.now()
    Document.objects.filter(state=DocumentState.TRANSMITTING, updated_at__lt=now - STUCK_AFTER).update(
        state=DocumentState.QUEUED, next_attempt_at=now
    )
    with transaction.atomic():
        rows = list(
            Document.objects.select_for_update(skip_locked=True)
            .filter(state__in=(DocumentState.QUEUED, DocumentState.CONTINGENCY_DIAN), next_attempt_at__lte=now)
            .order_by('next_attempt_at', 'id')
            .values_list('id', 'state')[:batch]
        )
        queued = [pk for pk, state in rows if state == DocumentState.QUEUED]
        in_contingency = [pk for pk, state in rows if state == DocumentState.CONTINGENCY_DIAN]
        Document.objects.filter(pk__in=queued).update(state=DocumentState.TRANSMITTING, updated_at=now)
        Document.objects.filter(pk__in=in_contingency).update(next_attempt_at=now + STUCK_AFTER, updated_at=now)
    return [pk for pk, _state in rows]


def transmit(document_id: int, gateway=None) -> Document:
    """Send one claimed document and record what happened."""
    document = Document.objects.select_related('issuer', 'client', 'original').get(pk=document_id)
    if document.kind != DocumentKind.INVOICE and document.original and document.original.state not in READY_ORIGINAL_STATES:
        # A note needs the CUFE of the invoice it corrects; wait for it without spending an attempt.
        return _requeue(document, WAIT_FOR_ORIGINAL, {'waiting_for': document.original_id})
    gateway = gateway or get_gateway(settings.DIAN_GATEWAY)
    document.attempts += 1
    try:
        result = gateway.send(_submission(document))
    except GatewayRefused as refusal:
        logger.warning('Documento %s rechazado por el gateway configurado: %s', document.pk, refusal)
        return _requeue(document, REFUSED_RETRY, {'gateway_refused': str(refusal)})
    except DianUnavailable as unavailable:
        return _after_unavailable(document, unavailable)
    return _record_result(document, result)


def _submission(document):
    return Submission(
        document_id=document.pk, kind=document.kind, environment=document.issuer.environment,
        issuer_nit=document.issuer.nit, prefix=document.prefix, number=document.number,
        issue_datetime=document.issue_datetime.isoformat(), payload=document.payload,
        payload_hash=document.payload_hash,
    )


def _requeue(document, wait, detail):
    document.state = DocumentState.QUEUED
    document.next_attempt_at = timezone.now() + wait
    document.save(update_fields=['state', 'next_attempt_at', 'attempts', 'updated_at'])
    DocumentEvent.objects.create(document=document, state=document.state, detail=detail)
    return document


def _after_unavailable(document, unavailable):
    wait, max_retries = RETRY_POLICY.get(unavailable.kind, RETRY_POLICY['error'])
    detail = {'dian_unavailable': str(unavailable), 'kind': unavailable.kind}
    already_in_contingency = document.state == DocumentState.CONTINGENCY_DIAN
    document.transient_failures += 1
    if not already_in_contingency and document.transient_failures <= max_retries:
        return _requeue(document, wait, detail)
    document.state = DocumentState.CONTINGENCY_DIAN
    document.next_attempt_at = timezone.now() + CONTINGENCY_POLL
    document.save(update_fields=['state', 'next_attempt_at', 'attempts', 'transient_failures', 'updated_at'])
    if not already_in_contingency:
        # Entering contingency is announced once; the 30-minute polls afterwards stay quiet.
        DocumentEvent.objects.create(document=document, state=document.state, detail=detail)
        _notify(document)
    return document


def _record_result(document, result):
    with transaction.atomic():
        if result.signed_xml:
            artifacts.store(document, ArtifactKind.SIGNED_XML, result.signed_xml, 'application/xml')
        if result.dian_response:
            content_type = 'application/json' if result.dian_response.lstrip().startswith(b'{') else 'application/xml'
            artifacts.store(document, ArtifactKind.DIAN_RESPONSE, result.dian_response, content_type)
        document.state = DocumentState.VALIDATED if result.state == 'validated' else DocumentState.REJECTED
        document.cufe = result.cufe or document.cufe
        document.qr_url = result.qr_url or document.qr_url
        document.errors = list(result.errors)
        document.transient_failures = 0
        document.next_attempt_at = None
        if document.state == DocumentState.VALIDATED:
            document.validated_at = timezone.now()
        document.save()
        DocumentEvent.objects.create(document=document, state=document.state, detail={'errors': list(result.errors)})
        _notify(document)
    return document


def _notify(document):
    delivery = webhooks.enqueue_notice(document)
    if delivery is not None:
        transaction.on_commit(lambda: _schedule_delivery(delivery.pk))


def _schedule_delivery(delivery_id):
    from fiscal_project.tasks import deliver_webhook

    deliver_webhook(delivery_id)



def run_once(batch: int = 20, gateway=None) -> int:
    """Transmit what is due now; returns how many documents were processed."""
    ids = claim_due(batch)
    for document_id in ids:
        try:
            transmit(document_id, gateway)
        except Exception:
            logger.exception('Error inesperado transmitiendo el documento %s', document_id)
    return len(ids)

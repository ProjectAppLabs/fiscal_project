"""Health of Fiscal. for api/health/: database, queue, background worker and the DIAN as seen from here.

`status` is `ok` when everything is fine and `degraded` otherwise; only a dead database answers 503, because the API
still receives documents (and queues them) while the worker or the DIAN are down.
"""

from datetime import timedelta

from django.db import DatabaseError, connection
from django.utils import timezone

from fiscal_app.models import Document, DocumentEvent, Heartbeat
from fiscal_app.models.choices import DocumentState

WORKER = 'worker'
WORKER_SILENT_AFTER = timedelta(minutes=3)
QUEUE_SLOW_AFTER = timedelta(minutes=15)


def beat(name: str = WORKER, now=None):
    Heartbeat.objects.update_or_create(name=name, defaults={'beat_at': now or timezone.now()})


def report(now=None) -> tuple[dict, int]:
    """The health report and its HTTP status."""
    now = now or timezone.now()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except DatabaseError:
        return {'status': 'down', 'database': 'down'}, 503
    queue = _queue(now)
    worker = _worker(now)
    dian = _dian()
    healthy = queue['ok'] and worker['ok'] and dian['in_contingency'] == 0
    return {'status': 'ok' if healthy else 'degraded', 'database': 'ok', 'queue': queue, 'worker': worker, 'dian': dian}, 200


def _queue(now):
    due = Document.objects.filter(state=DocumentState.QUEUED, next_attempt_at__lte=now)
    oldest = due.order_by('next_attempt_at').values_list('next_attempt_at', flat=True).first()
    waiting = int((now - oldest).total_seconds()) if oldest else 0
    return {'due': due.count(), 'oldest_due_seconds': waiting, 'ok': waiting < QUEUE_SLOW_AFTER.total_seconds()}


def _worker(now):
    beat_at = Heartbeat.objects.filter(name=WORKER).values_list('beat_at', flat=True).first()
    return {'last_beat_at': beat_at, 'ok': beat_at is not None and now - beat_at < WORKER_SILENT_AFTER}


def _dian():
    answered = (
        DocumentEvent.objects.filter(state__in=(DocumentState.VALIDATED, DocumentState.REJECTED))
        .order_by('-created_at').values_list('created_at', flat=True).first()
    )
    return {
        'in_contingency': Document.objects.filter(state=DocumentState.CONTINGENCY_DIAN).count(),
        'last_answer_at': answered,
    }

"""Alerts: what the business or ProjectApp must act on before it becomes a fiscal problem.

Thresholds come from the operation inventory (docs/fiscal/inventario/03-operacion.md): certificate at 30, 15 and 7
days, numbering below 10 %, resolution 30 days before it expires, contingencies at 24 h and 40 h of the 48 h the annex
allows (§12.1 and §12.2), any DIAN rejection and a queue stuck for more than 15 minutes.

Each condition raises one alert (deduplicated by key) and is announced once: by e-mail to ProjectApp and, when it
concerns an issuer, with a signed `issuer.alert` notice to its client system. When the condition clears, the alert
is resolved; rejections stay open until an operator resolves them.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.db.models import CharField, Max, Value
from django.db.models.functions import Cast, Concat
from django.utils import timezone

from fiscal_app.models import Alert, Certificate, Document, NumberingRange
from fiscal_app.models.choices import DocumentKind, DocumentState, RangeKind
from fiscal_app.services import webhooks

logger = logging.getLogger(__name__)
CERTIFICATE_DAYS = (7, 15, 30)
RANGE_LOW_SHARE = 0.10
RESOLUTION_DAYS = 30
CONTINGENCY_HOURS = (24, 40)
QUEUE_STUCK_AFTER = timedelta(minutes=15)
OPEN_STATES = (DocumentState.QUEUED, DocumentState.TRANSMITTING, DocumentState.CONTINGENCY_DIAN)


def raise_alert(kind, key, message, *, severity=Alert.Severity.WARNING, issuer=None, document=None) -> Alert | None:
    """Create the alert if it is not open yet and announce it; None when it was already open."""
    if Alert.objects.filter(key=key).exists():
        return None
    try:
        with transaction.atomic():
            alert = Alert.objects.create(kind=kind, key=key, message=message[:500], severity=severity, issuer=issuer,
                                         document=document)
    except IntegrityError:
        return None  # another worker raised it at the same time
    _announce(alert)
    return alert


def resolve(alerts, now=None) -> int:
    """Close alerts. Their key gets the id appended, so the same condition can raise a new alert if it comes back."""
    return alerts.filter(resolved_at__isnull=True).update(
        resolved_at=now or timezone.now(), key=Concat('key', Value('#'), Cast('id', CharField()))
    )


def resolve_missing(kind, active_keys, now=None):
    """Resolve the open alerts of a kind whose condition no longer holds."""
    return resolve(Alert.objects.filter(kind=kind).exclude(key__in=active_keys), now)


def check_all(now=None) -> int:
    """Run every periodic check; returns how many alerts were raised."""
    now = now or timezone.now()
    raised = 0
    for check in (_certificates, _ranges, _resolutions, _contingencies, _queue):
        raised += check(now)
    return raised


def rejection(document: Document) -> Alert | None:
    """A DIAN rejection: the business must correct the data and issue again."""
    rules = ', '.join(error.get('rule', '') for error in document.errors if error.get('severity', 'rechazo') == 'rechazo')
    return raise_alert(
        Alert.Kind.REJECTION, f'rejection:{document.pk}',
        f'La DIAN rechazó {document.full_number} de {document.issuer.legal_name}' + (f' (reglas {rules}).' if rules else '.'),
        severity=Alert.Severity.CRITICAL, issuer=document.issuer, document=document,
    )


def _certificates(now):
    raised, active = 0, []
    for certificate in Certificate.objects.filter(active=True).select_related('issuer'):
        days = (certificate.not_after - now).days
        threshold = next((limit for limit in CERTIFICATE_DAYS if days <= limit), None)
        if threshold is None:
            continue
        key = f'certificate:{certificate.pk}:{threshold}'
        active.append(key)
        message = (f'El certificado de {certificate.issuer.legal_name} vence el {certificate.not_after:%Y-%m-%d} '
                   f'({max(days, 0)} días). Sin certificado vigente no se puede facturar.')
        severity = Alert.Severity.CRITICAL if threshold == CERTIFICATE_DAYS[0] else Alert.Severity.WARNING
        raised += bool(raise_alert(Alert.Kind.CERTIFICATE_EXPIRING, key, message, severity=severity,
                                   issuer=certificate.issuer))
    resolve_missing(Alert.Kind.CERTIFICATE_EXPIRING, active, now)
    return raised


def _current_ranges(now):
    today = timezone.localdate(now)
    return NumberingRange.objects.filter(kind=RangeKind.INVOICE, active=True, valid_from__lte=today, valid_to__gte=today)


def _ranges(now):
    raised, active = 0, []
    for numbering in _current_ranges(now).select_related('issuer'):
        last = numbering.documents.aggregate(last=Max('number'))['last'] or numbering.number_from - 1
        size = numbering.number_to - numbering.number_from + 1
        remaining = numbering.number_to - last
        if remaining >= size * RANGE_LOW_SHARE:
            continue
        key = f'range:{numbering.pk}:low'
        active.append(key)
        message = (f'Al rango {numbering} de {numbering.issuer.legal_name} le quedan {remaining} números. '
                   'Pide una nueva resolución de numeración en el portal de la DIAN.')
        raised += bool(raise_alert(Alert.Kind.RANGE_LOW, key, message, issuer=numbering.issuer))
    resolve_missing(Alert.Kind.RANGE_LOW, active, now)
    return raised


def _resolutions(now):
    raised, active = 0, []
    limit = timezone.localdate(now) + timedelta(days=RESOLUTION_DAYS)
    for numbering in _current_ranges(now).filter(valid_to__lte=limit).select_related('issuer'):
        key = f'range:{numbering.pk}:expiring'
        active.append(key)
        message = (f'La resolución {numbering.resolution_number} de {numbering.issuer.legal_name} vence el '
                   f'{numbering.valid_to:%Y-%m-%d}. Después de esa fecha la DIAN rechaza la numeración.')
        raised += bool(raise_alert(Alert.Kind.RESOLUTION_EXPIRING, key, message, issuer=numbering.issuer))
    resolve_missing(Alert.Kind.RESOLUTION_EXPIRING, active, now)
    return raised


def _contingencies(now):
    """DIAN contingency counts from its start; a paper invoice (type 03) from when Fiscal. received it."""
    raised, active = 0, []
    pending = Document.objects.filter(state__in=OPEN_STATES, kind=DocumentKind.INVOICE).select_related('issuer')
    for document in pending:
        if document.contingency_started_at:
            started, what = document.contingency_started_at, 'en contingencia por falla de la DIAN'
        elif document.payload.get('issuer_contingency'):
            started, what = document.created_at, 'de contingencia del facturador (papel)'
        else:
            continue
        elapsed = now - started
        hours = max((limit for limit in CONTINGENCY_HOURS if elapsed >= timedelta(hours=limit)), default=None)
        if hours is None:
            continue
        key = f'contingency:{document.pk}:{hours}'
        active.append(key)
        message = (f'La factura {document.full_number} de {document.issuer.legal_name} lleva {hours} h {what} sin '
                   'transmitirse. El plazo de la DIAN es de 48 horas.')
        severity = Alert.Severity.CRITICAL if hours == CONTINGENCY_HOURS[-1] else Alert.Severity.WARNING
        raised += bool(raise_alert(Alert.Kind.CONTINGENCY_DEADLINE, key, message, severity=severity,
                                   issuer=document.issuer, document=document))
    resolve_missing(Alert.Kind.CONTINGENCY_DEADLINE, active, now)
    return raised


def _queue(now):
    oldest = (
        Document.objects.filter(state=DocumentState.QUEUED, next_attempt_at__lte=now - QUEUE_STUCK_AFTER)
        .order_by('next_attempt_at').first()
    )
    if oldest is None:
        resolve_missing(Alert.Kind.QUEUE_STUCK, [], now)
        return 0
    message = (f'Hay documentos en cola sin salir desde {timezone.localtime(oldest.next_attempt_at):%Y-%m-%d %H:%M}. '
               'Revisa que el trabajador de Huey esté corriendo.')
    return int(bool(raise_alert(Alert.Kind.QUEUE_STUCK, 'queue:stuck', message, severity=Alert.Severity.CRITICAL)))


def _announce(alert: Alert):
    recipients = [address for address in settings.FISCAL_ALERT_EMAILS if address]
    if recipients:
        try:
            send_mail(f'[Fiscal.] {alert.get_kind_display()}', alert.message, None, recipients)
        except Exception:
            logger.exception('No se pudo enviar el correo de la alerta %s', alert.pk)
    if alert.issuer is not None:
        delivery = webhooks.enqueue_alert(alert)
        if delivery is not None:
            transaction.on_commit(lambda: _schedule_delivery(delivery.pk))


def _schedule_delivery(delivery_id):
    from fiscal_project.tasks import deliver_webhook

    deliver_webhook(delivery_id)

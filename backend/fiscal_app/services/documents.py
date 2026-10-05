"""Reception of documents from client systems: idempotency, issuer readiness, numbering and prior validation."""

import hashlib
import json
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status

from fiscal_app.models import Document, DocumentEvent, Issuer
from fiscal_app.models.choices import DocumentKind, DocumentState, RangeKind
from fiscal_app.services.certificates import active_certificate
from fiscal_app.services.document_validation import validate_document
from fiscal_app.utils.errors import FiscalError

FUTURE_SKEW = timedelta(minutes=5)
# Outside an issuer contingency, a document must be sent the same day it is issued: the DIAN requires the issue
# date to be the signing date (annex FE 1.9, FAD09e).
MAX_AGE = timedelta(hours=24)


def body_hash(envelope: dict) -> str:
    return hashlib.sha256(json.dumps(envelope, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def business_date(moment):
    return moment.astimezone(ZoneInfo(settings.BUSINESS_TIME_ZONE)).date()


def submit_document(client, envelope: dict) -> tuple[Document, bool]:
    """Queue a document. Returns (document, created); resending the same body with the same key returns the same one."""
    key = envelope['idempotency_key']
    digest = body_hash(envelope)
    existing = Document.objects.filter(client=client, idempotency_key=key).first()
    if existing:
        return _same_or_conflict(existing, digest), False
    issuer = Issuer.objects.filter(client=client, nit=envelope['issuer']).first()
    if issuer is None:
        raise FiscalError('No hay un emisor con ese NIT.', 'issuer_not_found', status.HTTP_404_NOT_FOUND)
    _check_ready(issuer)
    kind = envelope['kind']
    issue_datetime = envelope['issue_datetime']
    document = envelope['document']
    contingency = bool(isinstance(document, dict) and document.get('issuer_contingency'))
    _check_issue_datetime(issue_datetime, contingency)
    numbering_range = _check_number(issuer, kind, envelope['prefix'], envelope['number'], issue_datetime, contingency)
    normalized, problems = validate_document(kind, document, issue_date=business_date(issue_datetime))
    original = _check_original(client, issuer, kind, normalized, problems)
    if problems:
        raise FiscalError(
            f'El documento tiene {len(problems)} problema(s) que la DIAN rechazaría.', 'invalid_document',
            extra={'problems': [problem.as_dict() for problem in problems]},
        )
    normalized['issuer_contingency'] = contingency
    try:
        with transaction.atomic():
            created = Document.objects.create(
                client=client, issuer=issuer, numbering_range=numbering_range, idempotency_key=key, kind=kind,
                prefix=envelope['prefix'], number=envelope['number'], issue_datetime=issue_datetime,
                payload=normalized, payload_hash=digest, original=original, next_attempt_at=timezone.now(),
                state=DocumentState.QUEUED,
            )
            DocumentEvent.objects.create(document=created, state=DocumentState.QUEUED, detail={'source': 'api'})
            transaction.on_commit(_schedule_transmission)
    except IntegrityError as error:
        # Two concurrent submissions with the same key: one wins, the other gets the same document.
        existing = Document.objects.filter(client=client, idempotency_key=key).first()
        if existing:
            return _same_or_conflict(existing, digest), False
        raise FiscalError(
            'Ese número ya existe para este emisor y tipo de documento.', 'duplicate_number', status.HTTP_409_CONFLICT
        ) from error
    return created, True


def _same_or_conflict(document, digest):
    if document.payload_hash != digest:
        raise FiscalError(
            'Esa clave de idempotencia ya se usó con otro contenido.', 'idempotency_conflict', status.HTTP_409_CONFLICT
        )
    return document


def _check_ready(issuer):
    missing = []
    certificate = active_certificate(issuer)
    if certificate is None or certificate.not_after <= timezone.now():
        missing.append('un certificado digital vigente')
    if not issuer.software_registrations.filter(environment=issuer.environment, active=True).exists():
        missing.append('el registro del software en su ambiente')
    if missing:
        raise FiscalError(
            f'El emisor todavía no puede facturar: le falta {" y ".join(missing)}.', 'issuer_not_ready',
            status.HTTP_409_CONFLICT,
        )


def _check_issue_datetime(issue_datetime, contingency):
    now = timezone.now()
    if issue_datetime > now + FUTURE_SKEW:
        raise FiscalError('La fecha de emisión está en el futuro.', 'issue_datetime_in_future')
    if not contingency and issue_datetime < now - MAX_AGE:
        raise FiscalError(
            'La fecha de emisión es de hace más de 24 horas; si hubo una falla del emisor, envíalo como contingencia.',
            'issue_datetime_too_old',
        )


def _check_number(issuer, kind, prefix, number, issue_datetime, contingency):
    if kind != DocumentKind.INVOICE:
        # Notes are numbered by the issuer without a DIAN resolution.
        return None
    range_kind = RangeKind.CONTINGENCY if contingency else RangeKind.INVOICE
    on_date = business_date(issue_datetime)
    for candidate in issuer.numbering_ranges.filter(kind=range_kind, prefix=prefix, active=True):
        if candidate.contains(number, on_date):
            return candidate
    raise FiscalError(
        'El número no está dentro de un rango de numeración vigente del emisor para esa fecha.', 'number_out_of_range'
    )


def _check_original(client, issuer, kind, normalized, problems):
    reference = normalized.get('billing_reference')
    if kind == DocumentKind.INVOICE or not reference:
        return None
    original = Document.objects.filter(
        client=client, issuer=issuer, kind=DocumentKind.INVOICE, pk=reference['document_id']
    ).first()
    if original is None:
        from fiscal_app.services.document_validation import Problem

        problems.append(Problem(
            'billing_reference.document_id', 'original_not_found',
            'La factura referenciada no existe para este emisor en Fiscal.',
        ))
    return original


def _schedule_transmission():
    from fiscal_project.tasks import transmit_due

    transmit_due()

"""Operator console API (JWT) for F5: issuers, alerts, contingencies, client systems and artifact downloads.

No secret ever leaves through here: not the .p12 or its password, the software PIN, the technical keys or the client
secrets. Only what an operator needs to act.
"""

import logging
from datetime import timedelta

from django.db.models import Count, Max, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from fiscal_app.models import Alert, ClientSystem, Document, Issuer
from fiscal_app.models.choices import DocumentKind, DocumentState
from fiscal_app.services.alerts import resolve
from fiscal_app.services.artifacts import ArtifactIntegrityError, read
from fiscal_app.services.client_systems import valid_secrets

from .console import ConsolePagination, IsConsoleOperator

logger = logging.getLogger(__name__)
CONTINGENCY_DEADLINE = timedelta(hours=48)
OPEN_STATES = (DocumentState.QUEUED, DocumentState.TRANSMITTING, DocumentState.CONTINGENCY_DIAN)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_issuers(request):
    issuers = (
        Issuer.objects.select_related('client')
        .annotate(
            documents_total=Count('documents', distinct=True),
            open_alerts=Count('alerts', filter=Q(alerts__resolved_at__isnull=True), distinct=True),
            certificate_expires=Max('certificates__not_after', filter=Q(certificates__active=True)),
        )
        .order_by('legal_name')
    )
    query = request.query_params.get('q', '').strip()
    if query:
        issuers = issuers.filter(Q(nit__startswith=query) | Q(legal_name__icontains=query))
    paginator = ConsolePagination()
    page = paginator.paginate_queryset(issuers, request)
    return paginator.get_paginated_response([_issuer_row(issuer) for issuer in page])


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_issuer(request, issuer_id):
    issuer = get_object_or_404(Issuer.objects.select_related('client'), pk=issuer_id)
    return Response({
        **_issuer_row(issuer, with_counts=False),
        'person_type': issuer.person_type,
        'trade_name': issuer.trade_name,
        'tax_responsibilities': issuer.tax_responsibilities,
        'address': {'line': issuer.address_line, 'municipality_code': issuer.municipality_code},
        'email': issuer.email,
        'certificates': [
            {'id': cert.pk, 'subject': cert.subject, 'issued_by': cert.issued_by, 'serial': cert.serial,
             'not_before': cert.not_before, 'not_after': cert.not_after, 'active': cert.active}
            for cert in issuer.certificates.order_by('-created_at')
        ],
        'software': [
            {'environment': item.environment, 'software_id': item.software_id, 'has_test_set': bool(item.test_set_id),
             'active': item.active, 'created_at': item.created_at}
            for item in issuer.software_registrations.order_by('-created_at')
        ],
        'ranges': [_range_row(numbering) for numbering in issuer.numbering_ranges.order_by('kind', 'prefix', 'number_from')],
        'alerts': [_alert_row(alert) for alert in issuer.alerts.filter(resolved_at__isnull=True)],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_alerts(request):
    alerts = Alert.objects.select_related('issuer', 'document').order_by('-created_at', '-id')
    if request.query_params.get('state', 'open') == 'open':
        alerts = alerts.filter(resolved_at__isnull=True)
    paginator = ConsolePagination()
    page = paginator.paginate_queryset(alerts, request)
    return paginator.get_paginated_response([_alert_row(alert) for alert in page])


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_resolve_alert(request, alert_id):
    alert = get_object_or_404(Alert, pk=alert_id)
    resolve(Alert.objects.filter(pk=alert.pk))
    alert.refresh_from_db()
    logger.info('Alerta %s resuelta por el operador %s', alert.pk, request.user.pk)
    return Response(_alert_row(alert))


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_contingencies(request):
    """Invoices waiting in DIAN contingency (type 04) or transcribed from paper (type 03), oldest deadline first."""
    now = timezone.now()
    pending = Document.objects.filter(state__in=OPEN_STATES, kind=DocumentKind.INVOICE).select_related('issuer', 'client')
    rows = []
    for document in pending:
        if document.contingency_started_at:
            kind, started = 'dian', document.contingency_started_at
        elif document.payload.get('issuer_contingency'):
            kind, started = 'issuer', document.created_at
        else:
            continue
        deadline = started + CONTINGENCY_DEADLINE
        rows.append({
            'id': document.pk, 'full_number': document.full_number, 'state': document.state, 'contingency': kind,
            'invoice_type': document.invoice_type, 'issuer': {'nit': document.issuer.nit, 'legal_name': document.issuer.legal_name},
            'client': document.client.name, 'started_at': started, 'deadline_at': deadline,
            'hours_left': round((deadline - now).total_seconds() / 3600, 1), 'attempts': document.attempts,
        })
    rows.sort(key=lambda row: row['deadline_at'])
    return Response({'count': len(rows), 'results': rows})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_client_systems(request):
    clients = ClientSystem.objects.annotate(
        issuers_total=Count('issuers', distinct=True),
        pending_notices=Count('webhook_deliveries', filter=Q(webhook_deliveries__delivered_at__isnull=True,
                                                             webhook_deliveries__next_attempt_at__isnull=False), distinct=True),
        failed_notices=Count('webhook_deliveries', filter=Q(webhook_deliveries__delivered_at__isnull=True,
                                                            webhook_deliveries__next_attempt_at__isnull=True), distinct=True),
        last_delivered_at=Max('webhook_deliveries__delivered_at'),
    ).order_by('name')
    return Response({'count': clients.count(), 'results': [
        {'id': client.pk, 'name': client.name, 'key_id': client.key_id, 'webhook_url': client.webhook_url,
         'active': client.active, 'valid_secrets': len(valid_secrets(client)), 'issuers': client.issuers_total,
         'pending_notices': client.pending_notices, 'failed_notices': client.failed_notices,
         'last_delivered_at': client.last_delivered_at, 'created_at': client.created_at}
        for client in clients
    ]})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_document_artifact(request, document_id, kind):
    """Latest artifact of a kind, checked against its SHA-256 before it is served (same rule as the machine API)."""
    document = get_object_or_404(Document, pk=document_id)
    artifact = document.artifacts.filter(kind=kind).order_by('-created_at', '-id').first()
    if artifact is None:
        return Response({'code': 'artifact_not_found', 'detail': 'El documento no tiene ese archivo.'}, status=404)
    try:
        content = read(artifact)
    except (ArtifactIntegrityError, OSError) as error:
        logger.error('Artefacto %s ilegible o alterado: %s', artifact.pk, error)
        return Response({'code': 'artifact_unavailable', 'detail': 'El archivo no coincide con su huella registrada.'},
                        status=503)
    response = HttpResponse(content, content_type=artifact.content_type)
    response['Content-Disposition'] = f'attachment; filename="{document.full_number}-{artifact.storage_path.rsplit("/", 1)[-1]}"'
    response['X-Fiscal-SHA256'] = artifact.sha256
    return response


def _issuer_row(issuer, with_counts=True):
    row = {
        'id': issuer.pk, 'nit': issuer.nit, 'dv': issuer.dv, 'legal_name': issuer.legal_name,
        'environment': issuer.environment, 'active': issuer.active, 'client': issuer.client.name,
    }
    if with_counts:
        row.update(documents=issuer.documents_total, open_alerts=issuer.open_alerts,
                   certificate_expires=issuer.certificate_expires)
    return row


def _range_row(numbering):
    last = numbering.documents.aggregate(last=Max('number'))['last']
    size = numbering.number_to - numbering.number_from + 1
    used = (last - numbering.number_from + 1) if last is not None else 0
    return {
        'id': numbering.pk, 'kind': numbering.kind, 'resolution_number': numbering.resolution_number,
        'prefix': numbering.prefix, 'number_from': numbering.number_from, 'number_to': numbering.number_to,
        'valid_from': numbering.valid_from, 'valid_to': numbering.valid_to, 'active': numbering.active,
        'establishment': numbering.establishment, 'last_number': last, 'used_share': round(used / size, 4),
    }


def _alert_row(alert):
    return {
        'id': alert.pk, 'kind': alert.kind, 'severity': alert.severity, 'message': alert.message,
        'issuer': {'id': alert.issuer.pk, 'nit': alert.issuer.nit, 'legal_name': alert.issuer.legal_name} if alert.issuer else None,
        'document': {'id': alert.document.pk, 'full_number': alert.document.full_number} if alert.document else None,
        'created_at': alert.created_at, 'resolved_at': alert.resolved_at,
    }

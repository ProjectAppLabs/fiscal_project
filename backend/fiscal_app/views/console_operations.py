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
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from fiscal_app.models import Alert, ClientSystem, Document, Issuer, NumberingRange
from fiscal_app.models.choices import DocumentKind, DocumentState
from fiscal_app.serializers import IssuerCreateUpdateSerializer
from fiscal_app.services.alerts import resolve
from fiscal_app.services.artifacts import ArtifactIntegrityError, read
from fiscal_app.services.client_systems import valid_secrets
from fiscal_app.services.origins import host_in_domain, normalize_host

from .console import ConsolePagination, IsConsoleAdmin, IsConsoleOperator

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


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_issuer(request, issuer_id):
    """GET: everything about an issuer. PATCH: correct its data (H-11); the NIT and the environment do not change here."""
    issuer = get_object_or_404(Issuer.objects.select_related('client'), pk=issuer_id)
    if request.method == 'PATCH':
        data = {key: value for key, value in request.data.items() if key not in ('nit', 'environment', 'client_id')}
        if 'origin_host' in data:
            denied = _set_origin_host(request, issuer, data.pop('origin_host'))
            if denied:
                return denied
        if 'municipality_code' in data and 'department_code' not in data:
            data['department_code'] = str(data['municipality_code'])[:2]
        if data:
            serializer = IssuerCreateUpdateSerializer(issuer, data=data, partial=True, context={'nit': issuer.nit})
            serializer.is_valid(raise_exception=True)
            serializer.save()
        logger.info('Emisor %s corregido por el operador %s: %s', issuer.pk, request.user.pk, sorted(data))
        issuer.refresh_from_db()
    return Response({
        **_issuer_row(issuer, with_counts=False),
        'person_type': issuer.person_type,
        'trade_name': issuer.trade_name,
        'tax_responsibilities': issuer.tax_responsibilities,
        'tax_scheme': issuer.tax_scheme,
        'address': {'line': issuer.address_line, 'municipality_code': issuer.municipality_code,
                    'department_code': issuer.department_code, 'postal_code': issuer.postal_code},
        'email': issuer.email,
        'origin_host': issuer.origin_host,
        'client_domain': issuer.client.domain,
        'client_allow_subdomains': issuer.client.allow_subdomains,
        'phone': issuer.phone,
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
    alerts = filtered_alerts(request.query_params)
    paginator = ConsolePagination()
    page = paginator.paginate_queryset(alerts, request)
    return paginator.get_paginated_response([_alert_row(alert) for alert in page])


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_resolve_alert(request, alert_id):
    alert = get_object_or_404(Alert, pk=alert_id)
    resolve(Alert.objects.filter(pk=alert.pk), by=request.user, note=str(request.data.get('note', '')).strip())
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
         'domain': client.domain, 'allow_subdomains': client.allow_subdomains, 'active': client.active, 'valid_secrets': len(valid_secrets(client)), 'issuers': client.issuers_total,
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


def _set_origin_host(request, issuer, value):
    """Re-bind an issuer to another host of its client system's domain (administrators). A Response when refused."""
    if not IsConsoleAdmin().has_permission(request, None):
        return Response({'detail': IsConsoleAdmin.message}, status=status.HTTP_403_FORBIDDEN)
    host = normalize_host(str(value or '')) if value else ''
    if value and not host:
        return Response({'origin_host': ['Escribe solo el host, por ejemplo restaurante.waiter.co.']}, status=status.HTTP_400_BAD_REQUEST)
    client = issuer.client
    if host and client.domain and not host_in_domain(host, client.domain, client.allow_subdomains):
        return Response({'origin_host': [f'Debe ser {client.domain} o uno de sus subdominios permitidos.']}, status=status.HTTP_400_BAD_REQUEST)
    issuer.origin_host = host
    issuer.save(update_fields=['origin_host', 'updated_at'])
    logger.warning('Emisor %s atado al origen «%s» por el operador %s', issuer.pk, host, request.user.pk)
    return None


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


def filtered_alerts(params):
    """Open (or all) alerts by severity, kind and issuer (H-30)."""
    alerts = Alert.objects.select_related('issuer', 'document', 'resolved_by').order_by('-created_at', '-id')
    if params.get('state', 'open') == 'open':
        alerts = alerts.filter(resolved_at__isnull=True)
    if params.get('severity') in Alert.Severity.values:
        alerts = alerts.filter(severity=params['severity'])
    if params.get('kind') in Alert.Kind.values:
        alerts = alerts.filter(kind=params['kind'])
    issuer = params.get('issuer', '')
    if issuer.isdigit():
        alerts = alerts.filter(issuer_id=int(issuer))
    return alerts


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_resolve_alerts(request):
    """Resolve several open alerts at once with one note."""
    ids = request.data.get('ids')
    if not isinstance(ids, list) or not ids or not all(isinstance(pk, int) for pk in ids) or len(ids) > 200:
        return Response({'ids': ['Indica entre 1 y 200 alertas.']}, status=status.HTTP_400_BAD_REQUEST)
    count = resolve(Alert.objects.filter(pk__in=ids), by=request.user, note=str(request.data.get('note', '')).strip())
    logger.info('%s alertas resueltas por el operador %s', count, request.user.pk)
    return Response({'resolved': count})


def _alert_row(alert):
    return {
        'id': alert.pk, 'kind': alert.kind, 'severity': alert.severity, 'message': alert.message,
        'issuer': {'id': alert.issuer.pk, 'nit': alert.issuer.nit, 'legal_name': alert.issuer.legal_name} if alert.issuer else None,
        'document': {'id': alert.document.pk, 'full_number': alert.document.full_number} if alert.document else None,
        'created_at': alert.created_at, 'resolved_at': alert.resolved_at,
        'resolved_by': (f'{alert.resolved_by.first_name} {alert.resolved_by.last_name}'.strip() or alert.resolved_by.email)
        if alert.resolved_by_id else '',
        'resolution_note': alert.resolution_note,
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleAdmin])
def console_issuer_activation(request, issuer_id):
    """Switch an issuer off or on (H-16). Off, its client system cannot issue for it; its documents are kept 10 years."""
    issuer = get_object_or_404(Issuer, pk=issuer_id)
    active = request.data.get('active')
    if not isinstance(active, bool):
        return Response({'active': ['Indica true o false.']}, status=status.HTTP_400_BAD_REQUEST)
    issuer.active = active
    issuer.save(update_fields=['active', 'updated_at'])
    logger.warning('Emisor %s %s por el administrador %s', issuer.pk, 'activado' if active else 'desactivado', request.user.pk)
    return Response({'id': issuer.pk, 'active': issuer.active})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsConsoleAdmin])
def console_range(request, issuer_id, range_id):
    """Switch a numbering range off or on (H-15). A range is never deleted: its documents point to it."""
    numbering = get_object_or_404(NumberingRange, pk=range_id, issuer_id=issuer_id)
    active = request.data.get('active')
    if not isinstance(active, bool):
        return Response({'active': ['Indica true o false.']}, status=status.HTTP_400_BAD_REQUEST)
    numbering.active = active
    numbering.save(update_fields=['active'])
    logger.info('Rango %s %s por el administrador %s', numbering.pk, 'activado' if active else 'desactivado', request.user.pk)
    return Response(_range_row(numbering))


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_test_set_runs(request, issuer_id):
    """Every test set run of the issuer, newest first, with how many documents the DIAN accepted (H-17)."""
    issuer = get_object_or_404(Issuer, pk=issuer_id)
    rows = []
    for run in issuer.test_set_runs.order_by('-created_at')[:20]:
        statuses = [entry.get('status') for entry in run.entries]
        rows.append({
            'id': run.pk, 'state': run.state, 'test_set_id': run.test_set_id, 'created_at': run.created_at,
            'updated_at': run.updated_at, 'total': len(statuses), 'accepted': statuses.count('accepted'),
            'rejected': statuses.count('rejected'), 'pending': statuses.count('pending'), 'error': run.error,
        })
    return Response({'count': len(rows), 'results': rows})

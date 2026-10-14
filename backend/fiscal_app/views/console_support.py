"""Operator console (JWT): support actions on a document, CSV exports and the service health in detail.

Replaces the transmit_pending server command for day-to-day support (H-26, H-28, H-29, H-36).
"""

import csv
import logging
from zoneinfo import ZoneInfo

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from fiscal_app.models import Document, WebhookDelivery
from fiscal_app.models.choices import DocumentState
from fiscal_app.services import support
from fiscal_app.services.health import report

from .console import IsConsoleOperator, filtered_documents
from .console_client_systems import DELIVERY_STATES
from .console_operations import filtered_alerts

logger = logging.getLogger(__name__)
COLOMBIA = ZoneInfo('America/Bogota')
EXPORT_LIMIT = 5000


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_document_action(request, document_id, action):
    """transmit · check-dian · resend-notice on one document; each one stays in its history."""
    document = get_object_or_404(Document.objects.select_related('issuer', 'client'), pk=document_id)
    try:
        if action == 'transmit':
            document = support.request_transmission(document, request.user)
            result = {'state': document.state, 'next_attempt_at': document.next_attempt_at}
        elif action == 'check-dian':
            result = support.ask_dian(document, request.user)
        elif action == 'resend-notice':
            delivery = support.resend_notice(document, request.user)
            result = {'delivered': delivery.delivered_at is not None, 'last_status': delivery.last_status, 'last_error': delivery.last_error}
        else:
            return Response({'detail': 'Acción desconocida.'}, status=status.HTTP_404_NOT_FOUND)
    except support.SupportError as error:
        return Response({'code': error.code, 'detail': str(error)}, status=status.HTTP_409_CONFLICT)
    logger.info('Acción %s sobre el documento %s por el operador %s', action, document.pk, request.user.pk)
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_documents_export(request):
    """The filtered documents as CSV (up to 5,000), with times in Colombia."""
    rows = filtered_documents(request.query_params)[:EXPORT_LIMIT]
    header = ['numero', 'tipo', 'emisor', 'nit', 'sistema_cliente', 'estado', 'intentos', 'emitido', 'validado', 'cufe']
    return _csv('documentos', header, (
        [doc.full_number, doc.kind, doc.issuer.legal_name, doc.issuer.nit, doc.client.name, doc.state, doc.attempts,
         _local(doc.issue_datetime), _local(doc.validated_at), doc.cufe]
        for doc in rows
    ))


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_alerts_export(request):
    rows = filtered_alerts(request.query_params)[:EXPORT_LIMIT]
    header = ['severidad', 'tipo', 'mensaje', 'emisor', 'documento', 'creada', 'resuelta', 'resuelta_por', 'nota']
    return _csv('alertas', header, (
        [alert.severity, alert.kind, alert.message, alert.issuer.legal_name if alert.issuer else '',
         alert.document.full_number if alert.document else '', _local(alert.created_at), _local(alert.resolved_at),
         alert.resolved_by.email if alert.resolved_by else '', alert.resolution_note]
        for alert in rows.select_related('resolved_by')
    ))


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_health(request):
    """The health report plus what waits: documents by open state and notices by state (H-36)."""
    data, _status = report()
    waiting = {state: Document.objects.filter(state=state).count()
               for state in (DocumentState.QUEUED, DocumentState.TRANSMITTING, DocumentState.CONTINGENCY_DIAN, DocumentState.CONTINGENCY_ISSUER)}
    notices = {name: WebhookDelivery.objects.filter(condition).count() for name, condition in DELIVERY_STATES.items() if name != 'delivered'}
    return Response({**data, 'documents': waiting, 'notices': notices, 'checked_at': timezone.now()})


def _csv(name, header, rows):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{name}-{timezone.localdate():%Y%m%d}.csv"'
    response.write('﻿')  # BOM so Excel reads the accents
    writer = csv.writer(response)
    writer.writerow(header)
    writer.writerows(_safe(row) for row in rows)
    return response


def _safe(row):
    # A cell that starts with = + - @ would run as a formula in a spreadsheet.
    return ["'" + value if isinstance(value, str) and value[:1] in ('=', '+', '-', '@') else value for value in row]


def _local(moment):
    return moment.astimezone(COLOMBIA).strftime('%Y-%m-%d %H:%M') if moment else ''

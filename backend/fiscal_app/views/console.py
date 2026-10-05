"""Operator console API (JWT): what the ProjectApp team needs to watch Fiscal. Client systems cannot use it."""

from datetime import date, timedelta
from urllib.parse import quote

from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from fiscal_app.models import Alert, ClientSystem, Document, DocumentEvent, Issuer, User
from fiscal_app.models.choices import DocumentState
from fiscal_app.serializers import (
    ConsoleDocumentDetailSerializer,
    ConsoleDocumentListSerializer,
)
from fiscal_app.services.contingency_letter import draft_letter
from fiscal_app.services.health import report


class IsConsoleOperator(BasePermission):
    """An active ProjectApp operator or admin (users of the console, never client systems)."""

    def has_permission(self, request, view):
        user = request.user
        return isinstance(user, User) and user.is_active and user.role in (User.Role.OPERATOR, User.Role.ADMIN)


class ConsolePagination(PageNumberPagination):
    page_size = 25


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_summary(request):
    counts = dict(Document.objects.values_list('state').annotate(total=Count('id')).order_by())
    by_state = {state: counts.get(state, 0) for state in DocumentState.values}
    now = timezone.now()
    queued = Document.objects.filter(state=DocumentState.QUEUED)
    oldest = queued.order_by('created_at').values_list('created_at', flat=True).first()
    rejection = (
        Document.objects.filter(state=DocumentState.REJECTED).select_related('issuer').order_by('-updated_at').first()
    )
    return Response({
        'documents': {'total': sum(by_state.values()), 'by_state': by_state},
        'issuers': Issuer.objects.count(),
        'client_systems': ClientSystem.objects.filter(active=True).count(),
        'queue': {'due': queued.filter(next_attempt_at__lte=now).count(), 'oldest_queued_at': oldest},
        'last_rejection': {
            'id': rejection.pk,
            'full_number': rejection.full_number,
            'issuer': {'nit': rejection.issuer.nit, 'legal_name': rejection.issuer.legal_name},
            'errors': rejection.errors,
            'at': rejection.updated_at,
        } if rejection else None,
        'alerts': _open_alerts(),
        'rejection_rate_24h': _rejection_rate(now),
        'health': report(now)[0],
    })


def _open_alerts():
    counts = dict(Alert.objects.filter(resolved_at__isnull=True).values_list('severity').annotate(total=Count('id')).order_by())
    return {'total': sum(counts.values()), 'critical': counts.get(Alert.Severity.CRITICAL, 0)}


def _rejection_rate(now):
    """Share of the DIAN's answers of the last 24 hours that were rejections (None without answers)."""
    answers = DocumentEvent.objects.filter(
        created_at__gte=now - timedelta(hours=24), state__in=(DocumentState.VALIDATED, DocumentState.REJECTED)
    )
    total = answers.count()
    return round(answers.filter(state=DocumentState.REJECTED).count() / total, 4) if total else None


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_documents(request):
    documents = Document.objects.select_related('client', 'issuer').order_by('-created_at', '-id')
    state = request.query_params.get('state')
    if state in DocumentState.values:
        documents = documents.filter(state=state)
    issuer = request.query_params.get('issuer', '').strip()
    if issuer:
        documents = documents.filter(issuer__nit=issuer)
    paginator = ConsolePagination()
    page = paginator.paginate_queryset(documents, request)
    return paginator.get_paginated_response(ConsoleDocumentListSerializer(page, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_document(request, document_id):
    document = get_object_or_404(Document.objects.select_related('client', 'issuer'), pk=document_id)
    return Response(ConsoleDocumentDetailSerializer(document).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_contingency_letter(request, issuer_id):
    """Draft of the issuer's contingency letter to the DIAN (annex §12.1) for a period, as a PDF to sign."""
    issuer = get_object_or_404(Issuer, pk=issuer_id)
    try:
        start = date.fromisoformat(request.query_params.get('from', ''))
        end = date.fromisoformat(request.query_params.get('to', ''))
    except ValueError:
        return Response({'code': 'invalid_period', 'detail': 'Indica el período con from y to (AAAA-MM-DD).'}, status=400)
    if start > end:
        return Response({'code': 'invalid_period', 'detail': 'La fecha inicial es posterior a la final.'}, status=400)
    draft = draft_letter(issuer, start, end, timezone.localdate())
    response = HttpResponse(draft.pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="carta-contingencia-{issuer.nit}-{start}-{end}.pdf"'
    response['X-Fiscal-Mail-Subject'] = quote(draft.subject)
    response['X-Fiscal-Mail-To'] = draft.recipient
    return response

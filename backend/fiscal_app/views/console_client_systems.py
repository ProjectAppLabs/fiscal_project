"""Operator console (JWT): run a client system from the web — its integration data, notice URL, secrets and notices.

Replaces the server commands create_client_system and rotate_client_secret. A secret is shown only in the answer that
creates it; changing secrets or switching a system off is for administrators.
"""

import logging
from datetime import timedelta

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from fiscal_app.models import ClientSystem, WebhookDelivery
from fiscal_app.services.client_systems import rotate_secret, secrets_overview
from fiscal_app.services.webhooks import requeue_failed, retry_now, send_ping

from .console import ConsolePagination, IsConsoleAdmin, IsConsoleOperator

logger = logging.getLogger(__name__)
DELIVERY_STATES = {
    'pending': Q(delivered_at__isnull=True, next_attempt_at__isnull=False),
    'failed': Q(delivered_at__isnull=True, next_attempt_at__isnull=True),
    'delivered': Q(delivered_at__isnull=False),
}


class ClientSystemUpdateSerializer(serializers.Serializer):
    webhook_url = serializers.URLField(required=False, allow_blank=True)
    active = serializers.BooleanField(required=False)

    def validate_webhook_url(self, value):
        if value and not value.startswith('https://') and not value.startswith('http://'):
            raise serializers.ValidationError('Usa una dirección http o https.')
        return value


class RotateSecretSerializer(serializers.Serializer):
    grace_hours = serializers.IntegerField(min_value=0, max_value=72, default=24)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_client_system(request, client_id):
    """GET: the integration data. PATCH: the notice URL (any operator) or switching it on/off (administrators)."""
    client = get_object_or_404(ClientSystem, pk=client_id)
    if request.method == 'PATCH':
        serializer = ClientSystemUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if 'active' in data and not IsConsoleAdmin().has_permission(request, None):
            return Response({'detail': IsConsoleAdmin.message}, status=status.HTTP_403_FORBIDDEN)
        for field, value in data.items():
            setattr(client, field, value)
        client.save(update_fields=list(data) or None)
        logger.info('Sistema cliente %s actualizado por el operador %s: %s', client.pk, request.user.pk, sorted(data))
    return Response(_detail(client))


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleAdmin])
def console_rotate_secret(request, client_id):
    """A new secret, shown only in this answer; the previous one keeps working for `grace_hours`."""
    client = get_object_or_404(ClientSystem, pk=client_id)
    serializer = RotateSecretSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    hours = serializer.validated_data['grace_hours']
    secret = rotate_secret(client, timedelta(hours=hours))
    logger.warning('Secreto del sistema cliente %s rotado por el operador %s (gracia %s h)', client.pk, request.user.pk, hours)
    return Response({'secret': secret, 'grace_hours': hours, 'secrets': secrets_overview(client)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_ping_client_system(request, client_id):
    """Send a signed test notice now and say how the client system answered."""
    client = get_object_or_404(ClientSystem, pk=client_id)
    if not client.webhook_url:
        return Response({'code': 'no_webhook', 'detail': 'El sistema cliente no tiene URL de avisos.'}, status=status.HTTP_409_CONFLICT)
    delivery = send_ping(client)
    return Response(_delivery_row(delivery))


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_client_deliveries(request, client_id):
    """The client's notices, newest first, optionally by state (pending, failed, delivered)."""
    client = get_object_or_404(ClientSystem, pk=client_id)
    deliveries = client.webhook_deliveries.select_related('document').order_by('-created_at', '-id')
    state = request.query_params.get('state', '')
    if state in DELIVERY_STATES:
        deliveries = deliveries.filter(DELIVERY_STATES[state])
    paginator = ConsolePagination()
    page = paginator.paginate_queryset(deliveries, request)
    return paginator.get_paginated_response([_delivery_row(delivery) for delivery in page])


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_retry_failed_deliveries(request, client_id):
    """Put every failed notice of the client back in the queue."""
    client = get_object_or_404(ClientSystem, pk=client_id)
    count = requeue_failed(client)
    logger.info('%s avisos del sistema cliente %s reencolados por el operador %s', count, client.pk, request.user.pk)
    return Response({'requeued': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_retry_delivery(request, delivery_id):
    """Send one notice again right away."""
    delivery = get_object_or_404(WebhookDelivery.objects.select_related('client', 'document'), pk=delivery_id)
    retry_now(delivery)
    delivery.refresh_from_db()
    return Response(_delivery_row(delivery))


def _detail(client):
    issuers = client.issuers.order_by('legal_name').values('id', 'nit', 'dv', 'legal_name', 'environment', 'active')
    notices = client.webhook_deliveries
    return {
        'id': client.pk, 'name': client.name, 'key_id': client.key_id, 'webhook_url': client.webhook_url,
        'active': client.active, 'created_at': client.created_at, 'secrets': secrets_overview(client),
        'issuers': list(issuers),
        'notices': {name: notices.filter(condition).count() for name, condition in DELIVERY_STATES.items()},
        'last_delivered_at': notices.filter(delivered_at__isnull=False).order_by('-delivered_at').values_list('delivered_at', flat=True).first(),
    }


def _delivery_row(delivery):
    event = delivery.payload.get('event', '')
    state = 'delivered' if delivery.delivered_at else 'pending' if delivery.next_attempt_at else 'failed'
    return {
        'id': delivery.pk, 'event': event, 'state': state, 'attempts': delivery.attempts,
        'document': {'id': delivery.document_id, 'full_number': delivery.document.full_number} if delivery.document_id else None,
        'alert_kind': delivery.payload.get('alert', {}).get('kind', '') if event == 'issuer.alert' else '',
        'last_status': delivery.last_status, 'last_error': delivery.last_error,
        'next_attempt_at': delivery.next_attempt_at, 'delivered_at': delivery.delivered_at, 'created_at': delivery.created_at,
        'payload': delivery.payload,
    }

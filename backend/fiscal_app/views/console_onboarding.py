"""Operator console (JWT): enrol a new business step by step and run its DIAN test set.

The same validations as the machine API apply (they share serializers and services). The certificate arrives as a
file upload and is validated and encrypted at once; neither the file, its password nor the software PIN are ever
logged or returned.
"""

import base64
import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from fiscal_app.models import ClientSystem, Issuer, TestSetRun
from fiscal_app.serializers import (
    IssuerCreateUpdateSerializer,
    NumberingRangeCreateUpdateSerializer,
    SoftwareRegistrationCreateUpdateSerializer,
)
from fiscal_app.services import test_set
from fiscal_app.services.certificates import set_certificate
from fiscal_app.services.client_systems import create_client_system
from fiscal_app.services.software import register_software

from .console import IsConsoleOperator

logger = logging.getLogger(__name__)
MAX_CERTIFICATE_BYTES = 100_000


class ClientSystemCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    webhook_url = serializers.URLField(required=False, allow_blank=True, default='')


class IssuerOnboardingSerializer(IssuerCreateUpdateSerializer):
    """The issuer data of the machine API plus the client system it belongs to and its NIT."""

    client_id = serializers.PrimaryKeyRelatedField(queryset=ClientSystem.objects.filter(active=True), source='client')
    nit = serializers.RegexField(r'^[0-9]{5,15}$', error_messages={'invalid': 'El NIT va sin puntos ni dígito de verificación.'})

    class Meta(IssuerCreateUpdateSerializer.Meta):
        fields = ('client_id', 'nit', *IssuerCreateUpdateSerializer.Meta.fields)
        # The view answers a repeated NIT with its own message in Spanish.
        validators = []

    def validate(self, attrs):
        self.context['nit'] = attrs.get('nit', '')
        return super().validate(attrs)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_create_client_system(request):
    """A new client system; its HMAC secret is returned only in this answer."""
    serializer = ClientSystemCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        client, secret = create_client_system(**serializer.validated_data)
    except IntegrityError:
        return Response({'name': ['Ya existe un sistema cliente con ese nombre.']}, status=status.HTTP_400_BAD_REQUEST)
    logger.info('Sistema cliente %s creado por el operador %s', client.pk, request.user.pk)
    return Response({'id': client.pk, 'name': client.name, 'key_id': client.key_id, 'secret': secret},
                    status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_create_issuer(request):
    serializer = IssuerOnboardingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if Issuer.objects.filter(client=data['client'], nit=data['nit']).exists():
        return Response({'nit': ['Ese NIT ya está inscrito en ese sistema cliente.']}, status=status.HTTP_400_BAD_REQUEST)
    issuer = serializer.save()
    logger.info('Emisor %s inscrito por el operador %s', issuer.pk, request.user.pk)
    return Response({'id': issuer.pk, 'nit': issuer.nit, 'legal_name': issuer.legal_name}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
@parser_classes([MultiPartParser, FormParser])
def console_upload_certificate(request, issuer_id):
    """The .p12/.pfx as a file and its password; validated (§10.14) and stored encrypted."""
    issuer = get_object_or_404(Issuer, pk=issuer_id)
    upload = request.FILES.get('p12')
    password = request.data.get('password', '')
    if upload is None or not password:
        return Response({'p12': ['Sube el archivo .p12 o .pfx y escribe su contraseña.']}, status=status.HTTP_400_BAD_REQUEST)
    if upload.size > MAX_CERTIFICATE_BYTES:
        return Response({'p12': ['El archivo es demasiado grande para ser un certificado.']}, status=status.HTTP_400_BAD_REQUEST)
    try:
        certificate = set_certificate(issuer, base64.b64encode(upload.read()).decode(), password)
    except DjangoValidationError as error:
        # The message never repeats the password or the file (fiscal_app.services.certificates).
        return Response({'p12': error.messages, 'code': error.code}, status=status.HTTP_400_BAD_REQUEST)
    logger.info('Certificado nuevo para el emisor %s (operador %s)', issuer.pk, request.user.pk)
    return Response({'id': certificate.pk, 'subject': certificate.subject, 'not_after': certificate.not_after},
                    status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
@parser_classes([JSONParser])
def console_register_software(request, issuer_id):
    issuer = get_object_or_404(Issuer, pk=issuer_id)
    serializer = SoftwareRegistrationCreateUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    registration = register_software(issuer, serializer.validated_data)
    return Response({'environment': registration.environment, 'software_id': registration.software_id,
                     'has_test_set': bool(registration.test_set_id)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
@parser_classes([JSONParser])
def console_create_range(request, issuer_id):
    issuer = get_object_or_404(Issuer, pk=issuer_id)
    serializer = NumberingRangeCreateUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if issuer.numbering_ranges.filter(resolution_number=data['resolution_number'], prefix=data['prefix']).exists():
        return Response({'resolution_number': ['Ese rango ya está registrado.']}, status=status.HTTP_400_BAD_REQUEST)
    numbering = serializer.save(issuer=issuer)
    return Response({'id': numbering.pk, 'prefix': numbering.prefix}, status=status.HTTP_201_CREATED)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_test_set(request, issuer_id):
    """GET: readiness and the latest run. POST: start a new run (habilitación only)."""
    issuer = get_object_or_404(Issuer, pk=issuer_id)
    if request.method == 'GET':
        run = issuer.test_set_runs.first()
        return Response({'readiness': test_set.readiness(issuer), 'run': _run(run) if run else None})
    invoices = request.data.get('invoices', test_set.SET_INVOICES)
    if not isinstance(invoices, int) or not 1 <= invoices <= 100:
        return Response({'invoices': ['Indica entre 1 y 100 facturas.']}, status=status.HTTP_400_BAD_REQUEST)
    try:
        run = test_set.start(issuer, invoices=invoices)
    except test_set.TestSetError as error:
        return Response({'code': 'not_ready', 'detail': str(error)}, status=status.HTTP_409_CONFLICT)
    logger.info('Set de pruebas %s iniciado para el emisor %s (operador %s)', run.pk, issuer.pk, request.user.pk)
    return Response(_run(run), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_check_test_set(request, run_id):
    run = get_object_or_404(TestSetRun.objects.select_related('issuer'), pk=run_id)
    return Response(_run(test_set.check(run)))


def _run(run):
    return {
        'id': run.pk, 'state': run.state, 'error': run.error, 'created_at': run.created_at, 'updated_at': run.updated_at,
        'documents': [
            {key: entry[key] for key in ('kind', 'full_number', 'code', 'status', 'messages', 'file_name')}
            for entry in run.entries
        ],
        'phases': [{'name': phase['name'], 'zip_key': phase.get('zip_key', ''), 'errors': phase.get('errors', [])}
                   for phase in run.phases],
    }

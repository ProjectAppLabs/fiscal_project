"""Machine API for client systems: issuers, their certificate, software registration and numbering ranges."""

from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response

from fiscal_app.authentication.client_system import (
    ClientSystemAuthentication,
    IsClientSystem,
)
from fiscal_app.models import Issuer
from fiscal_app.serializers import (
    CertificateCreateUpdateSerializer,
    CertificateDetailSerializer,
    IssuerCreateUpdateSerializer,
    IssuerDetailSerializer,
    NumberingRangeCreateUpdateSerializer,
    NumberingRangeListSerializer,
    SoftwareRegistrationCreateUpdateSerializer,
    SoftwareRegistrationDetailSerializer,
)
from fiscal_app.services.certificates import set_certificate
from fiscal_app.services.software import register_software
from fiscal_app.utils.errors import FiscalError

MACHINE = (authentication_classes([ClientSystemAuthentication]), permission_classes([IsClientSystem]))


def machine_view(methods):
    """@api_view for client systems: HMAC authentication, client-system permission."""

    def decorate(func):
        for decorator in reversed(MACHINE):
            func = decorator(func)
        return api_view(methods)(func)

    return decorate


def own_issuer(client, nit):
    """The issuer of this client system; another client's NIT answers exactly like a missing one."""
    issuer = Issuer.objects.filter(client=client, nit=nit).first()
    if issuer is None:
        raise FiscalError('No hay un emisor con ese NIT.', 'issuer_not_found', status.HTTP_404_NOT_FOUND)
    return issuer


@machine_view(['GET'])
def retrieve_issuer(request, nit):
    return Response(IssuerDetailSerializer(own_issuer(request.user, nit)).data)


@machine_view(['PUT'])
def update_issuer(request, nit):
    """Create or update a business. 201 when created, 200 when updated."""
    instance = Issuer.objects.filter(client=request.user, nit=nit).first()
    serializer = IssuerCreateUpdateSerializer(instance, data=request.data, context={'nit': nit})
    serializer.is_valid(raise_exception=True)
    issuer = serializer.save(client=request.user, nit=nit)
    code = status.HTTP_200_OK if instance else status.HTTP_201_CREATED
    return Response(IssuerDetailSerializer(issuer).data, status=code)


@machine_view(['PUT'])
def update_certificate(request, nit):
    issuer = own_issuer(request.user, nit)
    serializer = CertificateCreateUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    certificate = set_certificate(issuer, serializer.validated_data['p12'], serializer.validated_data['password'])
    return Response(CertificateDetailSerializer(certificate).data)


@machine_view(['PUT'])
def update_software(request, nit):
    """Register the software data of one environment; it becomes the only active one there."""
    issuer = own_issuer(request.user, nit)
    serializer = SoftwareRegistrationCreateUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    registration = register_software(issuer, serializer.validated_data)
    return Response(SoftwareRegistrationDetailSerializer(registration).data)


@machine_view(['GET'])
def list_ranges(request, nit):
    issuer = own_issuer(request.user, nit)
    return Response(NumberingRangeListSerializer(issuer.numbering_ranges.all(), many=True).data)


@machine_view(['POST'])
def create_range(request, nit):
    issuer = own_issuer(request.user, nit)
    serializer = NumberingRangeCreateUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if issuer.numbering_ranges.filter(
        resolution_number=serializer.validated_data['resolution_number'], prefix=serializer.validated_data['prefix']
    ).exists():
        raise FiscalError('Ese rango ya está registrado.', 'duplicate_range', status.HTTP_409_CONFLICT)
    numbering_range = serializer.save(issuer=issuer)
    return Response(NumberingRangeListSerializer(numbering_range).data, status=status.HTTP_201_CREATED)

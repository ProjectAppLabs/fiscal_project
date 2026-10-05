"""Machine API for client systems: documents and their artifacts."""

import logging

from django.http import HttpResponse
from rest_framework import status
from rest_framework.response import Response

from fiscal_app.models import Document
from fiscal_app.serializers import DocumentCreateSerializer, DocumentDetailSerializer
from fiscal_app.services.artifacts import ArtifactIntegrityError, read
from fiscal_app.services.documents import submit_document
from fiscal_app.utils.errors import FiscalError
from fiscal_app.views.issuers import machine_view

logger = logging.getLogger(__name__)


@machine_view(['POST'])
def create_document(request):
    """Queue a document: 202 when new, 200 when the same body was already received with the same key."""
    serializer = DocumentCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    envelope = {**serializer.validated_data, 'document': request.data.get('document')}
    document, created = submit_document(request.user, envelope)
    code = status.HTTP_202_ACCEPTED if created else status.HTTP_200_OK
    return Response(DocumentDetailSerializer(document).data, status=code)


def own_document(client, document_id):
    document = Document.objects.filter(client=client, pk=document_id).select_related('issuer').first()
    if document is None:
        raise FiscalError('No hay un documento con ese identificador.', 'document_not_found', status.HTTP_404_NOT_FOUND)
    return document


@machine_view(['GET'])
def retrieve_document(request, document_id):
    return Response(DocumentDetailSerializer(own_document(request.user, document_id)).data)


@machine_view(['GET'])
def retrieve_artifact(request, document_id, kind):
    """Latest artifact of a kind (signed_xml, dian_response…), checked against its SHA-256 before it is served."""
    artifact = own_document(request.user, document_id).artifacts.filter(kind=kind).order_by('-created_at', '-id').first()
    if artifact is None:
        raise FiscalError('El documento todavía no tiene ese archivo.', 'artifact_not_found', status.HTTP_404_NOT_FOUND)
    try:
        content = read(artifact)
    except (ArtifactIntegrityError, OSError) as error:
        logger.error('Artefacto %s ilegible o alterado: %s', artifact.pk, error)
        raise FiscalError(
            'El archivo no está disponible o no coincide con su huella registrada.',
            'artifact_unavailable', status.HTTP_503_SERVICE_UNAVAILABLE,
        ) from error
    response = HttpResponse(content, content_type=artifact.content_type)
    response['Content-Disposition'] = f'attachment; filename="{artifact.storage_path.rsplit("/", 1)[-1]}"'
    response['X-Fiscal-SHA256'] = artifact.sha256
    return response

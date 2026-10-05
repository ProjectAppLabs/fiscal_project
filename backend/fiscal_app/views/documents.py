"""Machine API for client systems: documents."""

from rest_framework import status
from rest_framework.response import Response

from fiscal_app.models import Document
from fiscal_app.serializers import DocumentCreateSerializer, DocumentDetailSerializer
from fiscal_app.services.documents import submit_document
from fiscal_app.utils.errors import FiscalError
from fiscal_app.views.issuers import machine_view


@machine_view(['POST'])
def create_document(request):
    """Queue a document: 202 when new, 200 when the same body was already received with the same key."""
    serializer = DocumentCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    envelope = {**serializer.validated_data, 'document': request.data.get('document')}
    document, created = submit_document(request.user, envelope)
    code = status.HTTP_202_ACCEPTED if created else status.HTTP_200_OK
    return Response(DocumentDetailSerializer(document).data, status=code)


@machine_view(['GET'])
def retrieve_document(request, document_id):
    document = Document.objects.filter(client=request.user, pk=document_id).select_related('issuer').first()
    if document is None:
        raise FiscalError('No hay un documento con ese identificador.', 'document_not_found', status.HTTP_404_NOT_FOUND)
    return Response(DocumentDetailSerializer(document).data)

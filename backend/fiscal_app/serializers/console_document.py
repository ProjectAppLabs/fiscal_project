from rest_framework import serializers

from fiscal_app.models import Document

from .document_detail import ArtifactListSerializer, DocumentEventDetailSerializer


class ConsoleIssuerSerializer(serializers.Serializer):
    nit = serializers.CharField()
    legal_name = serializers.CharField()


class ConsoleDocumentListSerializer(serializers.ModelSerializer):
    """A document as operators see it in the console list (no payload, no secrets)."""

    client = serializers.CharField(source='client.name')
    issuer = ConsoleIssuerSerializer()

    class Meta:
        model = Document
        fields = (
            'id', 'client', 'issuer', 'kind', 'full_number', 'state', 'attempts', 'issue_datetime', 'created_at',
            'validated_at',
        )


class ConsoleDocumentDetailSerializer(ConsoleDocumentListSerializer):
    """Full document for support: content, DIAN errors, artifacts (metadata only) and history."""

    original = serializers.PrimaryKeyRelatedField(read_only=True)
    artifacts = ArtifactListSerializer(many=True, read_only=True)
    events = DocumentEventDetailSerializer(many=True, read_only=True)

    class Meta(ConsoleDocumentListSerializer.Meta):
        fields = ConsoleDocumentListSerializer.Meta.fields + (
            'idempotency_key', 'cufe', 'qr_url', 'errors', 'original', 'payload', 'artifacts', 'events',
        )

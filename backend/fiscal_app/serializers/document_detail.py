from rest_framework import serializers

from fiscal_app.models import Document, DocumentEvent


class DocumentEventDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentEvent
        fields = ('state', 'detail', 'created_at')


class DocumentDetailSerializer(serializers.ModelSerializer):
    issuer = serializers.CharField(source='issuer.nit')
    original = serializers.PrimaryKeyRelatedField(read_only=True)
    events = DocumentEventDetailSerializer(many=True, read_only=True)

    class Meta:
        model = Document
        fields = (
            'id', 'idempotency_key', 'issuer', 'kind', 'prefix', 'number', 'full_number', 'issue_datetime', 'state',
            'cufe', 'qr_url', 'errors', 'attempts', 'original', 'validated_at', 'created_at', 'events',
        )

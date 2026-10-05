from rest_framework import serializers

from fiscal_app.models.choices import DocumentKind


class DocumentCreateSerializer(serializers.Serializer):
    """Envelope of a document; the commercial content (`document`) is checked by services.document_validation."""

    idempotency_key = serializers.CharField(max_length=120)
    issuer = serializers.RegexField(r'^[0-9]{5,15}$', error_messages={'invalid': 'Usa el NIT sin puntos ni dígito de verificación.'})
    kind = serializers.ChoiceField(choices=DocumentKind.choices)
    prefix = serializers.RegexField(r'^[A-Za-z0-9]{0,4}$', required=False, allow_blank=True, default='')
    number = serializers.IntegerField(min_value=1)
    issue_datetime = serializers.DateTimeField()
    document = serializers.DictField()

    def validate_prefix(self, value):
        return value.upper()

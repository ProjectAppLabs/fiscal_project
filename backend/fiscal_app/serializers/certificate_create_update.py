from rest_framework import serializers


class CertificateCreateUpdateSerializer(serializers.Serializer):
    """A .p12 in base64 and its password. Validated and encrypted by fiscal_app.services.certificates."""

    p12 = serializers.CharField(max_length=200_000, trim_whitespace=True)
    password = serializers.CharField(max_length=200, trim_whitespace=False)

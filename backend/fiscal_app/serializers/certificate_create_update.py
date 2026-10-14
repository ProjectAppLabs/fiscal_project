import base64
import binascii

from rest_framework import serializers


class CertificateCreateUpdateSerializer(serializers.Serializer):
    """The issuer's certificate in one of two forms, validated and encrypted by fiscal_app.services:

    - a .p12/.pfx in base64 and its password;
    - the certificate (.cer/.crt/.pem/.der, or the .zip the certification entity sends) and its private key, each in
      base64, with the key's password when it has one. Fiscal. assembles the .p12 (certificate_assembly).
    """

    p12 = serializers.CharField(max_length=200_000, trim_whitespace=True, required=False)
    password = serializers.CharField(max_length=200, trim_whitespace=False, required=False)
    certificate = serializers.CharField(max_length=200_000, trim_whitespace=True, required=False)
    private_key = serializers.CharField(max_length=200_000, trim_whitespace=True, required=False)
    key_password = serializers.CharField(max_length=200, trim_whitespace=False, required=False, allow_blank=True)

    def validate_certificate(self, value):
        return _decoded(value)

    def validate_private_key(self, value):
        return _decoded(value)

    def validate(self, attrs):
        separate = 'certificate' in attrs or 'private_key' in attrs
        if separate and 'p12' in attrs:
            raise serializers.ValidationError({'p12': ['Envía el .p12 o el certificado con su llave, no los dos.']})
        if separate and not ('certificate' in attrs and 'private_key' in attrs):
            raise serializers.ValidationError({'private_key': ['Envía el certificado y su llave privada.']})
        if not separate and not (attrs.get('p12') and attrs.get('password')):
            raise serializers.ValidationError({'p12': ['Envía el .p12 en base64 y su contraseña.']})
        return attrs


def _decoded(value):
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        raise serializers.ValidationError('No es un base64 válido.') from None

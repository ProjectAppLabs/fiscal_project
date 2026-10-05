from rest_framework import serializers

from fiscal_app.models import NumberingRange
from fiscal_app.models.choices import RangeKind


class NumberingRangeCreateUpdateSerializer(serializers.ModelSerializer):
    """A numbering authorization (Res. 000227 de 2025, arts. 1.5.1.6.x): prefix of up to 4 alphanumerics."""

    prefix = serializers.RegexField(
        r'^[A-Za-z0-9]{0,4}$', required=False, allow_blank=True, default='',
        error_messages={'invalid': 'El prefijo tiene hasta 4 caracteres alfanuméricos.'},
    )
    number_from = serializers.IntegerField(min_value=1)
    number_to = serializers.IntegerField(min_value=1)
    technical_key = serializers.CharField(max_length=200, required=False, allow_blank=True, default='', write_only=True)

    class Meta:
        model = NumberingRange
        fields = (
            'kind', 'resolution_number', 'resolution_date', 'prefix', 'number_from', 'number_to', 'valid_from',
            'valid_to', 'technical_key', 'establishment',
        )

    def validate_prefix(self, value):
        return value.upper()

    def validate(self, attrs):
        if attrs['number_from'] > attrs['number_to']:
            raise serializers.ValidationError({'number_to': [serializers.ErrorDetail(
                'El rango termina antes de empezar.', code='invalid_range'
            )]})
        if attrs['valid_from'] > attrs['valid_to']:
            raise serializers.ValidationError({'valid_to': [serializers.ErrorDetail(
                'La vigencia termina antes de empezar.', code='invalid_validity'
            )]})
        if attrs.get('kind', RangeKind.INVOICE) == RangeKind.INVOICE and not attrs.get('technical_key'):
            raise serializers.ValidationError({'technical_key': [serializers.ErrorDetail(
                'Un rango de facturación necesita su clave técnica (GetNumberingRange).', code='technical_key_required'
            )]})
        return attrs

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from fiscal_app.models import Issuer
from fiscal_app.models.choices import Environment, PersonType
from fiscal_app.services.nit import validate_nit

# Tax schemes of an issuer in stage 1 (TipoImpuesto / tributos): 01 IVA, 04 INC, ZZ not applicable.
# PR 4 replaces these checks with the DIAN genericode catalogs.
ISSUER_TAX_SCHEMES = ('01', '04', 'ZZ')
RESPONSIBILITY_PATTERN = re.compile(r'^[A-Z0-9]{1,4}(-[A-Z0-9]{1,4})?$')


class IssuerCreateUpdateSerializer(serializers.ModelSerializer):
    """Data a client system sends to register or update a business (the NIT comes in the URL)."""

    person_type = serializers.ChoiceField(choices=PersonType.choices)
    environment = serializers.ChoiceField(choices=Environment.choices, default=Environment.TESTING)
    tax_responsibilities = serializers.ListField(
        child=serializers.CharField(max_length=10), max_length=10, allow_empty=True, default=list
    )
    tax_scheme = serializers.ChoiceField(choices=[(code, code) for code in ISSUER_TAX_SCHEMES], default='01')
    municipality_code = serializers.RegexField(r'^[0-9]{5}$', error_messages={'invalid': 'Usa el código DANE de 5 dígitos.'})
    department_code = serializers.RegexField(r'^[0-9]{2}$', error_messages={'invalid': 'Usa el código DANE de 2 dígitos.'})
    postal_code = serializers.RegexField(r'^[0-9]{6}$', required=False, allow_blank=True)

    class Meta:
        model = Issuer
        fields = (
            'dv', 'person_type', 'legal_name', 'trade_name', 'tax_responsibilities', 'tax_scheme', 'address_line',
            'municipality_code', 'department_code', 'postal_code', 'email', 'phone', 'environment',
        )

    def validate_tax_responsibilities(self, value):
        codes = [code.strip().upper() for code in value]
        if any(not RESPONSIBILITY_PATTERN.match(code) for code in codes):
            raise serializers.ValidationError('Usa los códigos de responsabilidad de la DIAN (por ejemplo O-13 o ZZ).')
        return codes

    def validate(self, attrs):
        nit = self.context['nit']
        try:
            validate_nit(nit, attrs.get('dv', getattr(self.instance, 'dv', '')))
        except DjangoValidationError as error:
            raise serializers.ValidationError({'dv': [serializers.ErrorDetail(error.messages[0], code=error.code)]}) from error
        municipality = attrs.get('municipality_code', getattr(self.instance, 'municipality_code', ''))
        department = attrs.get('department_code', getattr(self.instance, 'department_code', ''))
        if municipality[:2] != department:
            raise serializers.ValidationError({
                'municipality_code': [serializers.ErrorDetail(
                    'El municipio no pertenece al departamento indicado.', code='municipality_department_mismatch'
                )]
            })
        return attrs

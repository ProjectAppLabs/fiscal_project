from rest_framework import serializers

from fiscal_app.models import Certificate, Issuer, NumberingRange, SoftwareRegistration


class CertificateDetailSerializer(serializers.ModelSerializer):
    """Public data of a certificate. The .p12 and its password never leave the service."""

    class Meta:
        model = Certificate
        fields = ('subject', 'issued_by', 'serial', 'not_before', 'not_after', 'active')


class SoftwareRegistrationDetailSerializer(serializers.ModelSerializer):
    """Registration data without the PIN: only whether it is set."""

    has_software_pin = serializers.SerializerMethodField()

    class Meta:
        model = SoftwareRegistration
        fields = (
            'environment', 'software_id', 'has_software_pin', 'test_set_id', 'manufacturer_nit',
            'manufacturer_name', 'software_name', 'active',
        )

    def get_has_software_pin(self, obj):
        return bool(obj.software_pin)


class NumberingRangeListSerializer(serializers.ModelSerializer):
    """A numbering range without its technical key: only whether it is set."""

    has_technical_key = serializers.SerializerMethodField()

    class Meta:
        model = NumberingRange
        fields = (
            'id', 'kind', 'resolution_number', 'resolution_date', 'prefix', 'number_from', 'number_to',
            'valid_from', 'valid_to', 'has_technical_key', 'establishment', 'active',
        )

    def get_has_technical_key(self, obj):
        return bool(obj.technical_key)


class IssuerDetailSerializer(serializers.ModelSerializer):
    certificate = serializers.SerializerMethodField()
    software_registrations = SoftwareRegistrationDetailSerializer(many=True, read_only=True)
    numbering_ranges = NumberingRangeListSerializer(many=True, read_only=True)

    class Meta:
        model = Issuer
        fields = (
            'nit', 'dv', 'person_type', 'legal_name', 'trade_name', 'tax_responsibilities', 'tax_scheme',
            'address_line', 'municipality_code', 'department_code', 'postal_code', 'country_code', 'email',
            'phone', 'environment', 'active', 'certificate', 'software_registrations', 'numbering_ranges',
        )

    def get_certificate(self, obj):
        active = obj.certificates.filter(active=True).order_by('-created_at').first()
        return CertificateDetailSerializer(active).data if active else None

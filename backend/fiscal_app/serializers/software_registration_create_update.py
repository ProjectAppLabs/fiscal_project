from rest_framework import serializers

from fiscal_app.models.choices import Environment


class SoftwareRegistrationCreateUpdateSerializer(serializers.Serializer):
    """What the DIAN portal returns when the business registers the software (and the PIN it chose)."""

    environment = serializers.ChoiceField(choices=Environment.choices)
    software_id = serializers.CharField(max_length=80)
    software_pin = serializers.CharField(max_length=80, trim_whitespace=False)
    test_set_id = serializers.CharField(max_length=80, required=False, allow_blank=True, default='')

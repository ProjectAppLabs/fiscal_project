"""The software as the issuer registered it in the DIAN portal: one active registration per environment."""

from django.db import transaction

from fiscal_app.models import Issuer, SoftwareRegistration


@transaction.atomic
def register_software(issuer: Issuer, data: dict) -> SoftwareRegistration:
    """Store the software id, PIN and TestSetId of an environment; it becomes the only active one there."""
    Issuer.objects.select_for_update().get(pk=issuer.pk)
    issuer.software_registrations.filter(environment=data['environment']).update(active=False)
    registration, _created = SoftwareRegistration.objects.update_or_create(
        issuer=issuer, environment=data['environment'], software_id=data['software_id'],
        defaults={'software_pin': data['software_pin'], 'test_set_id': data.get('test_set_id', ''), 'active': True},
    )
    return registration

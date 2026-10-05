from django.conf import settings
from django.db import models

from fiscal_app.utils.fields import EncryptedTextField

from .choices import Environment
from .issuer import Issuer


def default_manufacturer_nit():
    return settings.FISCAL_MANUFACTURER_NIT


def default_manufacturer_name():
    return settings.FISCAL_MANUFACTURER_NAME


def default_software_name():
    return settings.FISCAL_SOFTWARE_NAME


class SoftwareRegistration(models.Model):
    """The software as the issuer registered it in its DIAN portal (modality «software propio o adquirido»).

    ProjectApp is the manufacturer; the issuer is the invoicer. The DIAN returns the software id and the test set id;
    the PIN is chosen by whoever registers it and is used in the CUDE and the SoftwareSecurityCode.
    """

    issuer = models.ForeignKey(Issuer, on_delete=models.PROTECT, related_name='software_registrations')
    environment = models.CharField(max_length=1, choices=Environment.choices)
    software_id = models.CharField(max_length=80)
    software_pin = EncryptedTextField()
    test_set_id = models.CharField(max_length=80, blank=True, default='')
    manufacturer_nit = models.CharField(max_length=15, default=default_manufacturer_nit)
    manufacturer_name = models.CharField(max_length=200, default=default_manufacturer_name)
    software_name = models.CharField(max_length=100, default=default_software_name)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['issuer', 'environment', 'software_id'], name='software_unique_per_issuer_environment'
            )
        ]

    def __str__(self):
        return f'{self.software_name} · {self.issuer} · {self.get_environment_display()}'

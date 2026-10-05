from django.db import models

from .choices import Environment, PersonType
from .client_system import ClientSystem


class Issuer(models.Model):
    """A business that issues electronic documents with its own NIT, certificate and numbering (modality D1)."""

    client = models.ForeignKey(ClientSystem, on_delete=models.PROTECT, related_name='issuers')
    nit = models.CharField(max_length=15)
    dv = models.CharField(max_length=1)
    person_type = models.CharField(max_length=1, choices=PersonType.choices)
    legal_name = models.CharField(max_length=450)
    trade_name = models.CharField(max_length=450, blank=True, default='')
    # TipoResponsabilidad-2.1 codes (e.g. O-13, O-15, O-23, O-47, ZZ); validated against the DIAN list in PR 4.
    tax_responsibilities = models.JSONField(default=list, blank=True)
    # TipoImpuesto-2.1 code of the issuer's tax scheme (01 IVA, 04 INC, ZZ not applicable).
    tax_scheme = models.CharField(max_length=2, default='01')
    address_line = models.CharField(max_length=300)
    municipality_code = models.CharField(max_length=5, help_text='Código DANE del municipio (5 dígitos)')
    department_code = models.CharField(max_length=2, help_text='Código DANE del departamento (2 dígitos)')
    postal_code = models.CharField(max_length=10, blank=True, default='')
    country_code = models.CharField(max_length=2, default='CO')
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True, default='')
    environment = models.CharField(max_length=1, choices=Environment.choices, default=Environment.TESTING)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['legal_name']
        constraints = [models.UniqueConstraint(fields=['client', 'nit'], name='issuer_unique_nit_per_client')]

    def __str__(self):
        return f'{self.legal_name} ({self.nit}-{self.dv})'

    def clean(self):
        from fiscal_app.services.nit import validate_nit

        validate_nit(self.nit, self.dv)

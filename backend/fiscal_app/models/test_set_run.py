from django.db import models

from .issuer import Issuer


class TestSetRun(models.Model):
    """One run of the DIAN test set of an issuer in habilitación (annex FE 1.9 §7.9 and §7.12).

    The documents of the set have no fiscal value and are not Fiscal. documents: they live here, with what the DIAN
    answered for each one. `phases` keeps every ZIP sent (invoices first, then the notes that reference them).
    """

    __test__ = False  # its name starts with «Test»; pytest must not collect it

    class State(models.TextChoices):
        PROCESSING = 'processing', 'En proceso en la DIAN'
        ACCEPTED = 'accepted', 'Aceptado'
        REJECTED = 'rejected', 'Con rechazos'
        FAILED = 'failed', 'No se pudo enviar'

    issuer = models.ForeignKey(Issuer, on_delete=models.CASCADE, related_name='test_set_runs')
    test_set_id = models.CharField(max_length=80)
    state = models.CharField(max_length=10, choices=State.choices, default=State.PROCESSING)
    entries = models.JSONField(default=list)
    phases = models.JSONField(default=list)
    error = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f'{self.issuer} · set de pruebas {self.pk} · {self.get_state_display()}'

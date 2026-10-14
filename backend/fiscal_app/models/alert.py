from django.db import models

from .document import Document
from .issuer import Issuer


class Alert(models.Model):
    """Something an operator or the business must act on (annex FE 1.9 deadlines, certificates, numbering, the queue).

    `key` deduplicates: the same condition raises one alert until it is resolved. Alerts without issuer concern the
    whole service (DIAN down, queue stuck).
    """

    class Kind(models.TextChoices):
        CERTIFICATE_EXPIRING = 'certificate_expiring', 'Certificado por vencer'
        RANGE_LOW = 'range_low', 'Numeración por agotarse'
        RESOLUTION_EXPIRING = 'resolution_expiring', 'Resolución de numeración por vencer'
        CONTINGENCY_DEADLINE = 'contingency_deadline', 'Plazo de contingencia'
        REJECTION = 'rejection', 'Rechazo de la DIAN'
        QUEUE_STUCK = 'queue_stuck', 'Cola detenida'

    class Severity(models.TextChoices):
        WARNING = 'warning', 'Advertencia'
        CRITICAL = 'critical', 'Crítica'

    issuer = models.ForeignKey(Issuer, on_delete=models.CASCADE, related_name='alerts', null=True, blank=True)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='alerts', null=True, blank=True)
    kind = models.CharField(max_length=24, choices=Kind.choices)
    severity = models.CharField(max_length=8, choices=Severity.choices, default=Severity.WARNING)
    key = models.CharField(max_length=120, unique=True)
    message = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    # Who closed it from the console and why (empty when Fiscal. closed it because the condition went away).
    resolved_by = models.ForeignKey('fiscal_app.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    resolution_note = models.CharField(max_length=300, blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['resolved_at', 'created_at'], name='alert_open_idx')]

    def __str__(self):
        return f'{self.get_kind_display()}: {self.message}'


class Heartbeat(models.Model):
    """Last time a background process proved it is alive (the Huey worker); read by api/health/."""

    name = models.CharField(max_length=40, unique=True)
    beat_at = models.DateTimeField()

    def __str__(self):
        return f'{self.name} · {self.beat_at:%Y-%m-%d %H:%M:%S}'

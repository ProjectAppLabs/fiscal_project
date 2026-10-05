from django.db import models

from .client_system import ClientSystem
from .document import Document


class WebhookDelivery(models.Model):
    """A signed notice to a client system (a document state change or an issuer alert), retried until acknowledged."""

    client = models.ForeignKey(ClientSystem, on_delete=models.CASCADE, related_name='webhook_deliveries')
    document = models.ForeignKey(
        Document, on_delete=models.PROTECT, related_name='webhook_deliveries', null=True, blank=True
    )
    payload = models.JSONField()
    attempts = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    last_status = models.PositiveSmallIntegerField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['delivered_at', 'next_attempt_at'], name='webhook_pending_idx')]

    def __str__(self):
        subject = self.document or self.payload.get('event', '')
        return f'{self.client} · {subject} · {"entregado" if self.delivered_at else "pendiente"}'

from django.db import models

from fiscal_app.utils.fields import ExactCharField

from .choices import DocumentKind, DocumentState
from .client_system import ClientSystem
from .issuer import Issuer
from .numbering_range import NumberingRange


class Document(models.Model):
    """An electronic document requested by a client system.

    Once built, its number, CUFE/CUDE and signed XML never change, not even on retries: the DIAN validates each
    number only once (regla 90). The client system assigns the number with the issuer's authorized range.
    """

    client = models.ForeignKey(ClientSystem, on_delete=models.PROTECT, related_name='documents')
    issuer = models.ForeignKey(Issuer, on_delete=models.PROTECT, related_name='documents')
    numbering_range = models.ForeignKey(
        NumberingRange, on_delete=models.PROTECT, related_name='documents', null=True, blank=True
    )
    # Set by the client system (Waiter: «<org>:<document id>»). Resending the same body never issues twice.
    idempotency_key = ExactCharField(max_length=120)
    kind = models.CharField(max_length=11, choices=DocumentKind.choices)
    prefix = models.CharField(max_length=4, blank=True, default='')
    number = models.PositiveBigIntegerField()
    issue_datetime = models.DateTimeField()
    payload = models.JSONField()
    payload_hash = models.CharField(max_length=64)
    state = models.CharField(max_length=18, choices=DocumentState.choices, default=DocumentState.QUEUED)
    # CUFE (invoice) or CUDE (notes, type 03): SHA-384 in hex.
    cufe = models.CharField(max_length=96, blank=True, default='')
    qr_url = models.URLField(max_length=500, blank=True, default='')
    errors = models.JSONField(default=list, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    # The invoice a credit or debit note refers to (BillingReference).
    original = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='notes')
    validated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['client', 'idempotency_key'], name='document_unique_key_per_client'),
            models.UniqueConstraint(
                fields=['issuer', 'kind', 'prefix', 'number'], name='document_unique_number_per_issuer'
            ),
        ]
        indexes = [models.Index(fields=['state', 'next_attempt_at'], name='document_queue_idx')]

    def __str__(self):
        return f'{self.get_kind_display()} {self.prefix}{self.number} · {self.issuer.nit}'

    @property
    def full_number(self):
        return f'{self.prefix}{self.number}'


class DocumentEvent(models.Model):
    """History of a document: each state change with the response that caused it."""

    document = models.ForeignKey(Document, on_delete=models.PROTECT, related_name='events')
    state = models.CharField(max_length=18, choices=DocumentState.choices)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.document} → {self.state}'

from django.db import models

from fiscal_app.utils.fields import EncryptedTextField

from .issuer import Issuer


class Certificate(models.Model):
    """The issuer's own digital certificate (D7: each business pays for it).

    The .p12 (base64) and its password only exist encrypted and never leave the service; outside it only the
    subject, serial and validity are shown. Only one is active per issuer: `fiscal_app.services.certificates`
    enforces it, because MySQL ignores conditional unique constraints.
    """

    issuer = models.ForeignKey(Issuer, on_delete=models.PROTECT, related_name='certificates')
    p12 = EncryptedTextField()
    password = EncryptedTextField()
    subject = models.CharField(max_length=500)
    issued_by = models.CharField(max_length=500)
    serial = models.CharField(max_length=80)
    not_before = models.DateTimeField()
    not_after = models.DateTimeField()
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.subject} (hasta {self.not_after:%Y-%m-%d})'

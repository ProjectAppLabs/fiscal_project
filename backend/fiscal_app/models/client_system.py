from django.db import models

from fiscal_app.utils.fields import EncryptedTextField, ExactCharField


class ClientSystem(models.Model):
    """A system that uses Fiscal. through its API (Waiter first). Each one only sees its own issuers and documents."""

    name = models.CharField(max_length=80, unique=True)
    # Public identifier sent in X-Fiscal-Key. Compared byte by byte (see ExactCharField).
    key_id = ExactCharField(max_length=40, unique=True)
    # Where document state changes are announced (signed webhook, F1 PR 5).
    webhook_url = models.URLField(blank=True, default='')
    # The client system's domain (waiter.co). When set, every request declares its host in X-Fiscal-Origin (signed),
    # the host must be this domain or, with allow_subdomains, one of its subdomains, and the notice URL must be in it.
    domain = models.CharField(max_length=253, blank=True, default='')
    allow_subdomains = models.BooleanField(default=False)
    # IPs or networks (CIDR) the client system calls from; empty means any. The only network-level lock.
    allowed_ips = models.JSONField(default=list, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # DRF treats the authenticated client system as request.user.
    is_authenticated = True

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class ClientSecret(models.Model):
    """HMAC secret of a client system. Up to two are valid at once so a secret can be rotated without downtime."""

    client = models.ForeignKey(ClientSystem, on_delete=models.CASCADE, related_name='secrets')
    secret = EncryptedTextField()
    created_at = models.DateTimeField(auto_now_add=True)
    # None while it is the current secret; set when it is rotated out (it keeps working until then).
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.client} secret #{self.pk}'

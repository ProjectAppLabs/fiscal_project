import secrets
from datetime import timedelta

from django.db import models
from django.utils import timezone

from fiscal_app.models import User


class PasswordCode(models.Model):
    """A 6-digit code that lets an operator set a password: a reset (15 minutes) or an invitation (72 hours)."""

    class Purpose(models.TextChoices):
        RESET = 'reset', 'Restablecer contraseña'
        INVITE = 'invite', 'Invitación'

    VALIDITY = {Purpose.RESET: timedelta(minutes=15), Purpose.INVITE: timedelta(hours=72)}

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_codes')
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=10, choices=Purpose.choices, default=Purpose.RESET)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_purpose_display()} · {self.user.email}'

    @classmethod
    def generate_code(cls, user, purpose=Purpose.RESET):
        """A new code from the OS random source; earlier unused codes of the same purpose stop working."""
        user.password_codes.filter(purpose=purpose, used=False).update(used=True)
        code = f'{secrets.randbelow(1_000_000):06d}'
        return cls.objects.create(user=user, code=code, purpose=purpose)

    def is_valid(self):
        """Not used yet and younger than its purpose allows."""
        return not self.used and timezone.now() - self.created_at < self.VALIDITY[self.purpose]

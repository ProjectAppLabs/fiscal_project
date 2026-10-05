"""Model signal handlers of Fiscal."""

from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.utils import timezone

from .models import Artifact


class RetentionError(Exception):
    """An artifact with legal value cannot be deleted before its retention date."""


@receiver(pre_delete, sender=Artifact)
def protect_retained_artifact(sender, instance, **kwargs):
    # pre_delete also fires for queryset.delete(): a receiver disables Django's fast-delete path.
    if instance.retain_until >= timezone.localdate():
        raise RetentionError(
            f'El artefacto {instance.pk} debe conservarse hasta {instance.retain_until:%Y-%m-%d}.'
        )

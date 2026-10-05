from django.db import models

from .choices import ArtifactKind
from .document import Document


class Artifact(models.Model):
    """A stored file with legal value (signed XML, DIAN response, AttachedDocument, PDF, contingency evidence).

    Kept for 10 years (Ley 962 de 2005 art. 28; inventario 01 §7). Deleting it before `retain_until` is blocked
    by a pre_delete guard (fiscal_app.signals), for single objects and querysets alike.
    """

    document = models.ForeignKey(Document, on_delete=models.PROTECT, related_name='artifacts')
    kind = models.CharField(max_length=17, choices=ArtifactKind.choices)
    sha256 = models.CharField(max_length=64)
    size = models.PositiveBigIntegerField()
    content_type = models.CharField(max_length=100)
    storage_path = models.CharField(max_length=500)
    retain_until = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['document', 'created_at']

    def __str__(self):
        return f'{self.get_kind_display()} · {self.document}'

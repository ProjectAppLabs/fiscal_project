from django.db import models

from fiscal_app.utils.fields import EncryptedTextField

from .choices import RangeKind
from .issuer import Issuer


class NumberingRange(models.Model):
    """A numbering authorization of the issuer (Res. 000227 de 2025, arts. 1.5.1.6.x).

    Prefix of up to 4 alphanumeric characters, required when there is more than one establishment; validity of
    up to 2 years. The technical key (from GetNumberingRange) changes with every range and goes into the CUFE.
    Contingency ranges (paper or pad) are used for issuer contingency (type 03).
    """

    issuer = models.ForeignKey(Issuer, on_delete=models.PROTECT, related_name='numbering_ranges')
    kind = models.CharField(max_length=11, choices=RangeKind.choices, default=RangeKind.INVOICE)
    resolution_number = models.CharField(max_length=30)
    resolution_date = models.DateField(null=True, blank=True)
    prefix = models.CharField(max_length=4, blank=True, default='')
    number_from = models.PositiveBigIntegerField()
    number_to = models.PositiveBigIntegerField()
    valid_from = models.DateField()
    valid_to = models.DateField()
    technical_key = EncryptedTextField(blank=True, default='')
    establishment = models.CharField(max_length=120, blank=True, default='', help_text='Local o punto de venta')
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['issuer', 'prefix', 'number_from']
        constraints = [
            models.UniqueConstraint(
                fields=['issuer', 'resolution_number', 'prefix'], name='range_unique_resolution_prefix'
            ),
            models.CheckConstraint(condition=models.Q(number_from__lte=models.F('number_to')), name='range_numbers_ordered'),
            models.CheckConstraint(condition=models.Q(valid_from__lte=models.F('valid_to')), name='range_dates_ordered'),
        ]

    def __str__(self):
        return f'{self.prefix}{self.number_from}-{self.prefix}{self.number_to} ({self.resolution_number})'

    def contains(self, number, on_date):
        """True when the number is inside the range and the date inside its validity."""
        return self.number_from <= number <= self.number_to and self.valid_from <= on_date <= self.valid_to

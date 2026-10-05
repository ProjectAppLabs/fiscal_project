"""NIT check digit (dígito de verificación) as the DIAN computes it: modulo 11 with prime weights."""

import re

from django.core.exceptions import ValidationError

WEIGHTS = (3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71)


def check_digit(nit: str) -> str:
    """Return the check digit of a NIT given without dots or check digit."""
    total = sum(int(digit) * weight for digit, weight in zip(reversed(nit), WEIGHTS, strict=False))
    remainder = total % 11
    return str(11 - remainder if remainder > 1 else remainder)


def validate_nit(nit: str, dv: str) -> None:
    """Raise ValidationError (Spanish message, stable code) when the NIT or its check digit is wrong."""
    if not re.fullmatch(r'[0-9]{5,15}', nit or ''):
        raise ValidationError(
            'El NIT debe tener entre 5 y 15 dígitos, sin puntos ni dígito de verificación.', code='invalid_nit'
        )
    if dv != check_digit(nit):
        raise ValidationError('El dígito de verificación no corresponde al NIT.', code='invalid_dv')

"""Monetary rules of the DIAN annex FE 1.9 §5.2.1.

* Rounding is round-half-to-even (NTC 3711), at the precision of each field.
* Monetary values tolerate an error of +/- 2.00 (§5.2.1.1).
* IVA tax amounts tolerate +/- 5.00 when rounded to the nearest ten pesos (§5.2.1.2, Decreto 1625 art. 1.3.1.1.1).
"""

from decimal import ROUND_HALF_EVEN, Decimal, InvalidOperation

CENT = Decimal('0.01')
MONEY_TOLERANCE = Decimal('2.00')
IVA_TOLERANCE = Decimal('5.00')


def to_decimal(value) -> Decimal | None:
    """Parse a JSON amount (string or number) without float artefacts; None when it is not a finite number."""
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    return number if number.is_finite() else None


def round_money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)


def within(expected: Decimal, actual: Decimal, tolerance: Decimal = MONEY_TOLERANCE) -> bool:
    return abs(round_money(expected) - round_money(actual)) <= tolerance

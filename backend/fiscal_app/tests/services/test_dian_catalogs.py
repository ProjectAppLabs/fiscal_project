"""Tests for the official DIAN code lists and money rules (dian package)."""

from decimal import Decimal

import pytest
from dian.catalogs import GENERICODE_DIR, code_list, tax_rates
from dian.money import round_money, to_decimal, within


def test_every_vendored_list_loads():
    """Fails if a genericode file copied from the DIAN toolkit is missing or cannot be parsed."""
    names = [path.name.removesuffix('-2.1.gc') for path in GENERICODE_DIR.glob('*-2.1.gc')]

    assert len(names) == 19
    assert all(code_list(name) for name in names)


@pytest.mark.parametrize(
    ('list_name', 'code', 'name'),
    [
        ('TipoIdFiscal', '13', 'Cédula de ciudadanía'),
        ('TipoIdFiscal', '31', 'NIT'),
        ('TipoImpuesto', '04', 'INC'),
        ('UnidadesMedida', '94', 'unidad'),
        ('Municipio', '05001', 'Medellín'),
        ('ConceptoNotaCredito', '2', 'Anulación de factura electrónica'),
        ('FormasPago', '1', 'Contado'),
    ],
)
def test_key_codes_match_the_dian_lists(list_name, code, name):
    """Fails if a code Fiscal. relies on disappears or changes meaning in the vendored DIAN lists."""
    assert code_list(list_name)[code] == name


def test_inc_rates_are_the_official_ones():
    """Fails if the allowed INC rates differ from the DIAN list (2, 4, 8 and 16 %)."""
    assert tax_rates('04') == {'2.00', '4.00', '8.00', '16.00'}


@pytest.mark.parametrize(('value', 'expected'), [('2.345', '2.34'), ('2.355', '2.36'), ('2.3450001', '2.35')])
def test_money_rounds_half_to_even(value, expected):
    """Fails if amounts stop rounding half-to-even (NTC 3711), as the annex FE 1.9 §5.2.1 requires."""
    assert round_money(Decimal(value)) == Decimal(expected)


def test_tolerance_is_two_pesos():
    """Fails if the +/- 2.00 tolerance of the annex (§5.2.1.1) is not applied."""
    assert within(Decimal('100.00'), Decimal('102.00')) is True
    assert within(Decimal('100.00'), Decimal('102.01')) is False


@pytest.mark.parametrize('value', [None, True, 'abc', 'NaN', 'Infinity'])
def test_non_finite_amounts_are_rejected(value):
    """Fails if a boolean, text or non-finite value is read as an amount."""
    assert to_decimal(value) is None

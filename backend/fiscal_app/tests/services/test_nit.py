"""Tests for the DIAN check digit of the NIT."""

import pytest
from django.core.exceptions import ValidationError

from fiscal_app.services.nit import check_digit, validate_nit


@pytest.mark.parametrize(('nit', 'dv'), [('800197268', '4'), ('860034313', '7'), ('900373115', '3')])
def test_check_digit_matches_known_nits(nit, dv):
    """Fails if the check digit stops following the DIAN algorithm (NITs of the DIAN and two companies)."""
    assert check_digit(nit) == dv


@pytest.mark.parametrize('nit', ['', '1234', '800.197.268', '8001972684-4', 'abc123456'])
def test_malformed_nit_is_rejected(nit):
    """Fails if a NIT with dots, check digit, letters or too few digits is accepted."""
    with pytest.raises(ValidationError) as error:
        validate_nit(nit, '0')
    assert error.value.code == 'invalid_nit'


def test_wrong_check_digit_is_rejected():
    """Fails if a NIT is accepted with a check digit that does not belong to it."""
    with pytest.raises(ValidationError) as error:
        validate_nit('800197268', '5')
    assert error.value.code == 'invalid_dv'

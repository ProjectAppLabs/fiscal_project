"""Tests for the Fiscal. core models and their database constraints."""

from datetime import date

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from fiscal_app.models import Issuer, NumberingRange


@pytest.mark.django_db
def test_same_idempotency_key_twice_is_rejected(make_document):
    """Fails if one client system can store two documents under the same idempotency key."""
    make_document()

    with pytest.raises(IntegrityError):
        make_document(number=990_000_002)


@pytest.mark.django_db
def test_same_number_twice_is_rejected(make_document):
    """Fails if an issuer can hold two documents of one kind with the same prefix and number (DIAN regla 90)."""
    make_document()

    with pytest.raises(IntegrityError):
        make_document(idempotency_key='waiter:2')


@pytest.mark.django_db
def test_credit_note_may_reuse_an_invoice_number(make_document):
    """Fails if notes cannot have their own numbering next to the invoices of the same issuer."""
    make_document()

    note = make_document(idempotency_key='waiter:nc-1', kind='credit_note')

    assert note.number == 990_000_001


@pytest.mark.django_db
def test_issuer_nit_is_unique_per_client(issuer):
    """Fails if a client system can register the same NIT twice."""
    with pytest.raises(IntegrityError):
        Issuer.objects.create(
            client=issuer.client, nit=issuer.nit, dv=issuer.dv, person_type='1', legal_name='Otra',
            address_line='x', municipality_code='05001', department_code='05', email='x@x.test',
        )


@pytest.mark.django_db
def test_issuer_clean_rejects_a_wrong_check_digit(issuer):
    """Fails if the admin can save an issuer whose check digit does not match its NIT."""
    issuer.dv = '0' if issuer.dv != '0' else '1'

    with pytest.raises(ValidationError) as error:
        issuer.clean()
    assert error.value.code == 'invalid_dv'


@pytest.mark.django_db
def test_range_with_inverted_numbers_is_rejected(issuer):
    """Fails if a numbering range can end before it starts."""
    with pytest.raises(IntegrityError):
        NumberingRange.objects.create(
            issuer=issuer, resolution_number='1', prefix='A', number_from=10, number_to=1,
            valid_from=date(2026, 1, 1), valid_to=date(2027, 1, 1),
        )


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('number', 'on_date', 'expected'),
    [
        (990_000_500, date(2026, 10, 4), True),
        (995_000_001, date(2026, 10, 4), False),
        (990_000_500, date(2031, 1, 1), False),
    ],
)
def test_range_contains_only_authorized_numbers(invoice_range, number, on_date, expected):
    """Fails if a number outside the range, or a date outside its validity, is considered authorized."""
    assert invoice_range.contains(number, on_date) is expected


@pytest.mark.django_db
def test_document_full_number_prefixes_the_consecutive(make_document):
    """Fails if the printed document number stops being prefix followed by consecutive, as the DIAN shows it."""
    assert make_document().full_number == 'SETP990000001'


@pytest.mark.django_db
def test_technical_key_is_stored_encrypted(invoice_range):
    """Fails if a range's technical key (it goes into every CUFE) is stored in plain text."""
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute('SELECT technical_key FROM fiscal_app_numberingrange WHERE id = %s', [invoice_range.pk])
        stored = cursor.fetchone()[0]

    assert 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c' not in stored

"""Tests for the prior validation of the commercial document (DIAN annex FE 1.9 rules)."""

import copy

import pytest

from fiscal_app.services.document_validation import validate_document
from fiscal_app.tests.conftest import restaurant_bill


def problems_of(document, kind='invoice'):
    """Problems of a document as (code, DIAN rule) pairs."""
    _normalized, problems = validate_document(kind, document)
    return {(problem.code, problem.rule) for problem in problems}


def codes_of(document, kind='invoice'):
    """Problem codes of a document."""
    return {code for code, _rule in problems_of(document, kind)}


def test_valid_restaurant_bill_has_no_problems():
    """Fails if a correct restaurant bill (INC, points redemption, 10 % tip) would be refused."""
    assert problems_of(restaurant_bill()) == set()


def test_final_consumer_gets_the_dian_identity():
    """Fails if a final consumer is not sent as 222222222222, type 13, R-99-PN (annex FAK62, FAK26)."""
    normalized, _problems = validate_document('invoice', restaurant_bill())

    assert normalized['buyer']['id_number'] == '222222222222'
    assert normalized['buyer']['id_type'] == '13'
    assert normalized['buyer']['tax_responsibilities'] == ['R-99-PN']


def test_line_value_must_be_quantity_times_price():
    """Fails if a line whose value is not quantity × price − discounts + charges passes (FAV06)."""
    bill = restaurant_bill()
    bill['lines'][0]['line_extension'] = '30000.00'

    assert ('line_extension_mismatch', 'FAV06') in problems_of(bill)


def test_rounding_within_two_pesos_is_tolerated():
    """Fails if a difference within the annex tolerance of +/- 2.00 is refused (§5.2.1.1)."""
    bill = restaurant_bill()
    bill['lines'][0]['taxes'][0]['amount'] = '2953.50'
    bill['totals']['tax_inclusive'] = '46333.50'
    bill['totals']['payable'] = '45623.50'

    assert problems_of(bill) == set()


def test_tax_must_be_base_times_rate():
    """Fails if a tax amount that is not base × rate passes (FAS07)."""
    bill = restaurant_bill()
    bill['lines'][1]['taxes'][0]['amount'] = '600.00'

    assert ('tax_amount_mismatch', 'FAS07') in problems_of(bill)


def test_unknown_inc_rate_is_refused():
    """Fails if an INC rate outside the DIAN list (2, 4, 8, 16) is accepted."""
    bill = restaurant_bill()
    bill['lines'][0]['taxes'][0]['rate'] = '10.00'

    assert 'invalid_tax_rate' in codes_of(bill)


def test_tip_can_never_be_part_of_the_tax_base():
    """Fails if a tax base larger than the line value (e.g. including the tip) passes."""
    bill = restaurant_bill()
    bill['lines'][0]['taxes'][0]['taxable_amount'] = '40590.00'

    assert 'taxable_amount_mismatch' in codes_of(bill)


def test_tip_above_ten_percent_is_refused():
    """Fails if a tip above 10 % of the consumption passes (Ley 1935 de 2018)."""
    bill = restaurant_bill()
    bill['charges'][0]['amount'] = '5000.00'
    bill['totals']['charge_total'] = '5000.00'
    bill['totals']['payable'] = '46332.00'

    assert 'tip_above_limit' in codes_of(bill)


def test_negative_line_is_refused():
    """Fails if a negative line (e.g. points redemption as a line) passes: the DIAN does not accept it."""
    bill = restaurant_bill()
    bill['lines'][1]['line_extension'] = '-5000.00'

    assert 'negative_amount' in codes_of(bill)


@pytest.mark.parametrize(
    ('total', 'rule'),
    [('line_extension', 'FAU02'), ('tax_exclusive', 'FAU04'), ('tax_inclusive', 'FAU06'),
     ('allowance_total', 'FAU08'), ('charge_total', 'FAU10'), ('payable', 'FAU14')],
)
def test_each_total_is_checked_with_its_dian_rule(total, rule):
    """Fails if a wrong document total passes, or is reported without its annex rule."""
    bill = restaurant_bill()
    bill['totals'][total] = '1.00'

    assert (f'{total}_mismatch', rule) in problems_of(bill)


def test_zero_quantity_is_refused():
    """Fails if a line with quantity zero passes (FAV04b)."""
    bill = restaurant_bill()
    bill['lines'][0]['quantity'] = '0'

    assert ('zero_amount', 'FAV04b') in problems_of(bill)


def test_unknown_unit_code_is_refused():
    """Fails if a unit outside the DIAN list is accepted (FAV05)."""
    bill = restaurant_bill()
    bill['lines'][0]['unit_code'] = 'XYZ'

    assert ('invalid_unit_code', 'FAV05') in problems_of(bill)


def test_buyer_nit_needs_its_check_digit():
    """Fails if a buyer identified by NIT passes with a wrong check digit (FAK64)."""
    bill = restaurant_bill()
    bill['buyer'] = {'id_type': '31', 'id_number': '800197268', 'dv': '1', 'person_type': '1', 'name': 'DIAN'}

    assert ('invalid_dv', 'FAK64') in problems_of(bill)


def test_delivery_to_final_consumer_needs_an_address():
    """Fails if a home delivery to a final consumer passes without the delivery address (Res. 227 art. 1.5.1.2.2.1)."""
    bill = restaurant_bill()
    bill['sale_channel'] = 'delivery'

    assert 'delivery_address_required' in codes_of(bill)


def test_delivery_address_needs_a_dane_municipality():
    """Fails if a delivery address with a municipality outside the DANE list passes."""
    bill = restaurant_bill()
    bill.update(sale_channel='delivery', delivery_address={'line': 'Cra 70 # 1-2', 'municipality_code': '99999'})

    assert 'invalid_municipality' in codes_of(bill)


def test_credit_payment_needs_a_due_date():
    """Fails if a credit sale passes without its due date (FAN04)."""
    bill = restaurant_bill()
    bill['payment'] = {'form': '2', 'means': ['10']}

    assert ('due_date_required', 'FAN04') in problems_of(bill)


def test_unknown_payment_means_is_refused():
    """Fails if a payment means outside the DIAN list passes (FAN03)."""
    bill = restaurant_bill()
    bill['payment']['means'] = ['999']

    assert ('invalid_payment_means', 'FAN03') in problems_of(bill)


def test_foreign_currency_is_not_supported_yet():
    """Fails if a document in another currency is accepted before stage 2."""
    bill = restaurant_bill()
    bill['currency'] = 'USD'

    assert 'unsupported_currency' in codes_of(bill)


def test_other_taxes_are_not_supported_yet():
    """Fails if a tribute other than IVA or INC is accepted before stage 2."""
    bill = restaurant_bill()
    bill['lines'][0]['taxes'][0]['code'] = '22'

    assert 'unsupported_tax' in codes_of(bill)


def test_credit_note_needs_its_invoice_reference():
    """Fails if a credit note passes without referencing the invoice it corrects."""
    assert 'reference_required' in codes_of(restaurant_bill(), kind='credit_note')


def test_credit_note_concept_must_be_a_dian_concept():
    """Fails if a credit note with a concept outside the DIAN list passes."""
    bill = restaurant_bill()
    bill['billing_reference'] = {'document_id': 1, 'concept_code': '9'}

    assert 'invalid_concept' in codes_of(bill, kind='credit_note')


def test_problems_are_reported_together():
    """Fails if only the first problem is reported, forcing the client to fix one error per request."""
    bill = copy.deepcopy(restaurant_bill())
    bill['payment']['means'] = ['999']
    bill['lines'][0]['unit_code'] = 'XYZ'

    assert {'invalid_payment_means', 'invalid_unit_code'} <= codes_of(bill)

"""Tests for CUFE, CUDE, software security code and QR against the DIAN annex FE 1.9 examples."""

from decimal import Decimal

from dian.codes import (
    CodeInput,
    code_chain,
    cude,
    cufe,
    qr_text,
    qr_url,
    software_security_code,
    truncated,
)

# Annex FE 1.9 §11.2.1: example invoice and its CUFE.
ANNEX_INVOICE = CodeInput(
    number='323200000129', issue_date='2019-01-16', issue_time='10:53:10-05:00', line_extension=Decimal('1500000.00'),
    iva=Decimal('285000.00'), inc=Decimal('0'), ica=Decimal('0'), payable=Decimal('1785000.00'),
    issuer_nit='700085371', buyer_id='800199436', environment='1',
)
# Annex FE 1.9 §11.4: contingency type-03 transcription and its CUDE (software PIN 12345).
ANNEX_TYPE_03 = CodeInput(
    number='8110007871', issue_date='2019-02-20', issue_time='16:46:55-05:00', line_extension=Decimal('235.28'),
    iva=Decimal('19.00'), inc=Decimal('0'), ica=Decimal('8.28'), payable=Decimal('262.56'),
    issuer_nit='900373076', buyer_id='8355990', environment='2',
)


def test_cufe_matches_the_annex_example():
    """Fails if the CUFE differs from the annex FE 1.9 §11.2.1 example: the DIAN would reject every invoice."""
    code = cufe(ANNEX_INVOICE, '693ff6f2a553c3646a063436fd4dd9ded0311471')

    assert code == '8bb918b19ba22a694f1da11c643b5e9de39adf60311cf179179e9b33381030bcd4c3c3f156c506ed5908f9276f5bd9b4'


def test_cude_matches_the_annex_example():
    """Fails if the CUDE (software PIN instead of technical key) differs from the annex FE 1.9 §11.4 example."""
    code = cude(ANNEX_TYPE_03, '12345')

    assert code == '955327eb55f8bdf16d069358a063d87e1577a292cb088ec186ed60bbc38e750b7b3980659b278ead789b95f9c51a9ef7'


def test_amounts_are_truncated_not_rounded():
    """Fails if the CUFE string rounds amounts instead of truncating them to two decimals (§11.2)."""
    assert truncated(Decimal('262.569')) == '262.56'
    assert truncated(Decimal('0')) == '0.00'


def test_software_security_code_is_sha384_of_id_pin_and_number():
    """Fails if the software fingerprint stops being SHA-384(software id + PIN + number) (§11.8)."""
    import hashlib

    expected = hashlib.sha384(b'fa326ca7-c1f8-40d3-a6fc-24d7c104060712345SETP990000001').hexdigest()

    assert software_security_code('fa326ca7-c1f8-40d3-a6fc-24d7c1040607', '12345', 'SETP990000001') == expected


def test_qr_url_depends_on_the_environment():
    """Fails if a testing document points to the production lookup or the reverse (§11.7.1)."""
    assert qr_url('abc', '2') == 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=abc'
    assert qr_url('abc', '1') == 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=abc'


def test_qr_text_has_the_annex_fields():
    """Fails if the QR content loses a field of the annex example (§11.7)."""
    text = qr_text(ANNEX_INVOICE, 'e5bac48e', Decimal('0'))

    assert text.splitlines()[:5] == [
        'NumFac: 323200000129', 'FecFac: 2019-01-16', 'HorFac: 10:53:10-05:00', 'NitFac: 700085371',
        'DocAdq: 800199436',
    ]
    assert 'ValTolFac: 1785000.00' in text


def test_credit_note_cude_matches_the_annex_example():
    """Fails if a credit note CUDE differs from the annex FE 1.9 §11.4.3 example (software PIN 12301)."""
    note = CodeInput(
        number='8110007871', issue_date='2019-01-12', issue_time='07:00:00-05:00', line_extension=Decimal('5000.00'),
        iva=Decimal('950.00'), inc=Decimal('0'), ica=Decimal('0'), payable=Decimal('5950.00'),
        issuer_nit='900373076', buyer_id='8355990', environment='1',
    )

    assert cude(note, '12301') == (
        '907e4444decc9e59c160a2fb3b6659b33dc5b632a5008922b9a62f83f757b1c448e47f5867f2b50dbdb96f48c7681168'
    )


def test_debit_note_chain_matches_the_annex_composition():
    """Fails if the debit note CUDE string differs from the annex §11.4.5 composition.

    The hash printed in that annex example does not match its own composition string (annex erratum), so the
    composition is what is checked here; the hash itself is covered by the credit note example.
    """
    note = CodeInput(
        number='ND1001', issue_date='2019-01-18', issue_time='10:58:00-05:00', line_extension=Decimal('30000.00'),
        iva=Decimal('0'), inc=Decimal('2400.00'), ica=Decimal('0'), payable=Decimal('32400.00'),
        issuer_nit='900197264', buyer_id='10254102', environment='2',
    )

    assert code_chain(note, '10201') == 'ND10012019-01-1810:58:00-05:0030000.00010.00042400.00030.0032400.0090019726410254102102012'

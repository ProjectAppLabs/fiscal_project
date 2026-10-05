"""Tests for the UBL 2.1 invoice built from a Fiscal. document (annex FE 1.9, official XSD)."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from dian.codes import qr_url
from dian.ubl.common import NS
from dian.ubl.invoice import build_invoice, code_input
from dian.xsd import errors

from fiscal_app.models import SoftwareRegistration
from fiscal_app.services.document_validation import validate_document
from fiscal_app.services.ubl_mapping import document_spec, resolution_of
from fiscal_app.tests.conftest import restaurant_bill


@pytest.fixture
def built(ready_issuer, make_document, invoice_range):
    """Build the restaurant bill of contract v1, issued at 13:05 Colombian time, as a UBL invoice."""
    issued = datetime(2026, 10, 4, 13, 5, tzinfo=ZoneInfo('America/Bogota'))
    payload, _problems = validate_document('invoice', restaurant_bill())
    document = make_document(payload=payload, issue_datetime=issued)
    software = SoftwareRegistration.objects.get(issuer=ready_issuer)
    spec = document_spec(document, software)
    return spec, build_invoice(spec, resolution_of(invoice_range))


def text(root, path):
    """Text of a UBL path (cbc:/cac: prefixes)."""
    return root.findtext(path, namespaces=NS)


@pytest.mark.django_db
def test_restaurant_invoice_is_valid_against_the_dian_xsd(built):
    """Fails if the invoice Fiscal. builds does not validate against the official UBL 2.1 / DIAN schemas."""
    _spec, invoice = built

    assert errors(invoice.root) == []


@pytest.mark.django_db
def test_uuid_is_the_cufe_with_the_range_key(built, invoice_range):
    """Fails if cbc:UUID is not the CUFE computed with the range's technical key."""
    from dian.codes import cufe

    spec, invoice = built

    assert text(invoice.root, 'cbc:UUID') == cufe(code_input(spec), invoice_range.technical_key)
    assert invoice.root.find('cbc:UUID', NS).get('schemeName') == 'CUFE-SHA384'


@pytest.mark.django_db
def test_issue_time_is_colombian_legal_time(built):
    """Fails if the issue time is not written in -05:00 (FAD10), e.g. in UTC."""
    _spec, invoice = built

    assert text(invoice.root, 'cbc:IssueDate') == '2026-10-04'
    assert text(invoice.root, 'cbc:IssueTime') == '13:05:00-05:00'


@pytest.mark.django_db
def test_tip_is_a_conditioned_charge_outside_the_taxes(built):
    """Fails if the tip is not informed as charge code 03 (table 13.3.8) with its 10 % over the consumption."""
    _spec, invoice = built
    charge = next(node for node in invoice.root.findall('cac:AllowanceCharge', NS) if text(node, 'cbc:ChargeIndicator') == 'true')

    assert text(charge, 'cbc:AllowanceChargeReasonCode') == '03'
    assert text(charge, 'cbc:MultiplierFactorNumeric') == '10.00'
    assert text(invoice.root, 'cac:LegalMonetaryTotal/cbc:ChargeTotalAmount') == '4290.00'


@pytest.mark.django_db
def test_points_redemption_is_a_global_discount(built):
    """Fails if the points redemption is not an unconditioned discount (code 00) instead of a negative line."""
    _spec, invoice = built
    discount = next(node for node in invoice.root.findall('cac:AllowanceCharge', NS) if text(node, 'cbc:ChargeIndicator') == 'false')

    assert text(discount, 'cbc:AllowanceChargeReasonCode') == '00'
    assert text(invoice.root, 'cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount') == '5000.00'


@pytest.mark.django_db
def test_final_consumer_is_informed_as_the_annex_says(built):
    """Fails if the final consumer is not 222222222222, type 13, R-99-PN and tax scheme ZZ (FAK62, FAK26)."""
    _spec, invoice = built
    scheme = invoice.root.find('cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme', NS)

    assert text(scheme, 'cbc:CompanyID') == '222222222222'
    assert scheme.find('cbc:CompanyID', NS).get('schemeName') == '13'
    assert text(scheme, 'cbc:TaxLevelCode') == 'R-99-PN'
    assert text(scheme, 'cac:TaxScheme/cbc:ID') == 'ZZ'


@pytest.mark.django_db
def test_inc_is_grouped_in_one_tax_total(built):
    """Fails if INC at 8 % is not one TaxTotal with one TaxSubtotal for the whole document (FAS01a)."""
    _spec, invoice = built
    totals = invoice.root.findall('cac:TaxTotal', NS)

    assert len(totals) == 1
    assert text(totals[0], 'cbc:TaxAmount') == '3432.00'
    assert text(totals[0], 'cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:Name') == 'INC'


@pytest.mark.django_db
def test_qr_code_is_the_lookup_url_of_the_cufe(built):
    """Fails if sts:QRCode is not the DIAN lookup URL with the document's CUFE (FAB36)."""
    _spec, invoice = built
    qr = invoice.root.findtext('.//sts:QRCode', namespaces=NS)

    assert qr == qr_url(invoice.code, '2')


@pytest.mark.django_db
def test_issuer_is_its_own_technology_provider(built, ready_issuer):
    """Fails if the software provider is not the issuer itself (modality D1, FAB19) with its check digit."""
    _spec, invoice = built
    provider = invoice.root.find('.//sts:ProviderID', NS)

    assert (provider.text, provider.get('schemeID')) == (ready_issuer.nit, ready_issuer.dv)


@pytest.mark.django_db
def test_type_03_transcription_uses_the_cude(built, invoice_range):
    """Fails if a contingency type-03 invoice uses the CUFE instead of the CUDE with the software PIN (§11.4)."""
    from dian.codes import cude

    spec, _invoice = built

    transcription = build_invoice(spec, resolution_of(invoice_range), invoice_type='03')

    assert transcription.code == cude(code_input(spec), spec.software.pin)
    assert text(transcription.root, 'cbc:InvoiceTypeCode') == '03'


@pytest.fixture
def delivery_to_company(ready_issuer, make_document, invoice_range):
    """Build a home delivery invoiced to a company identified by NIT, with address and card payment."""
    bill = restaurant_bill()
    bill['buyer'] = {
        'id_type': '31', 'id_number': '800197268', 'dv': '4', 'person_type': '1', 'name': 'DIAN',
        'tax_responsibilities': ['O-13', 'O-15'], 'tax_scheme': '01', 'email': 'compras@empresa.test',
        'address': {'line': 'Cra 8 # 6C-38', 'municipality_code': '11001'},
    }
    bill['sale_channel'] = 'delivery'
    bill['delivery_address'] = {'line': 'Cra 70 # 1-2 apto 301', 'municipality_code': '05001'}
    bill['payment'] = {'form': '1', 'means': ['48']}
    payload, problems = validate_document('invoice', bill)
    assert problems == []
    document = make_document(payload=payload, idempotency_key='waiter:delivery')
    spec = document_spec(document, SoftwareRegistration.objects.get(issuer=ready_issuer))
    return build_invoice(spec, resolution_of(invoice_range))


@pytest.mark.django_db
def test_company_buyer_with_delivery_is_valid_against_the_xsd(delivery_to_company):
    """Fails if an invoice to an identified company, with delivery address, breaks the official schemas."""
    assert errors(delivery_to_company.root) == []


@pytest.mark.django_db
def test_company_buyer_carries_its_check_digit_and_responsibilities(delivery_to_company):
    """Fails if a NIT buyer loses its check digit (FAK64) or its responsibilities joined with ';' (FAK26)."""
    scheme = delivery_to_company.root.find('cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme', NS)

    assert scheme.find('cbc:CompanyID', NS).get('schemeID') == '4'
    assert text(scheme, 'cbc:TaxLevelCode') == 'O-13;O-15'


@pytest.mark.django_db
def test_delivery_address_uses_dane_names(delivery_to_company):
    """Fails if the delivery address loses its DANE municipality and department names."""
    address = delivery_to_company.root.find('cac:Delivery/cac:DeliveryAddress', NS)

    assert (text(address, 'cbc:CityName'), text(address, 'cbc:CountrySubentity')) == ('Medellín', 'Antioquia')

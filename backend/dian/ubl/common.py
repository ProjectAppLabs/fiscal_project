"""Namespaces, data and element builders shared by the DIAN UBL documents."""

from dataclasses import dataclass, field
from decimal import ROUND_HALF_EVEN, Decimal

from lxml import etree

from dian.catalogs import code_list

NS = {
    'inv': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    'cn': 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
    'dn': 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2',
    'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
    'sts': 'dian:gov:co:facturaelectronica:Structures-2-1',
    'ds': 'http://www.w3.org/2000/09/xmldsig#',
    'xades': 'http://uri.etsi.org/01903/v1.3.2#',
    'xades141': 'http://uri.etsi.org/01903/v1.4.1#',
}
DIAN_AGENCY = {'schemeAgencyID': '195', 'schemeAgencyName': 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)'}
DIAN_NIT, DIAN_DV = '800197268', '4'
TAX_NAMES = {'01': 'IVA', '04': 'INC', 'ZZ': 'No aplica'}
# Codes of discounts and charges (table 13.3.8): 00 unconditioned discount; 02 unconditioned charge;
# 03 conditioned charge, "se utilizará para informar las Propinas".
ALLOWANCE_CODE, CHARGE_CODE, TIP_CODE = '00', '02', '03'


def money(value) -> str:
    """Monetary value with two decimals, rounded half-to-even (annex FE 1.9 §5.2.1)."""
    return str(Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN))


def qname(prefix: str, tag: str) -> str:
    return f'{{{NS[prefix]}}}{tag}'


def sub(parent, prefixed_tag: str, text=None, **attributes):
    """Append an element written as 'cbc:ID'; attributes with a None value are left out."""
    prefix, tag = prefixed_tag.split(':')
    element = etree.SubElement(parent, qname(prefix, tag), {k: str(v) for k, v in attributes.items() if v is not None})
    if text is not None:
        element.text = str(text)
    return element


def amount(parent, prefixed_tag: str, value, currency: str = 'COP'):
    return sub(parent, prefixed_tag, money(value), currencyID=currency)


@dataclass(frozen=True)
class Address:
    line: str
    municipality_code: str  # DANE, 5 digits
    postal_code: str = ''

    @property
    def department_code(self) -> str:
        return self.municipality_code[:2]

    @property
    def city_name(self) -> str:
        return code_list('Municipio').get(self.municipality_code, '')

    @property
    def department_name(self) -> str:
        return code_list('Departamentos').get(self.department_code, '')


@dataclass(frozen=True)
class Party:
    """Issuer or buyer as the DIAN wants it in AccountingSupplierParty / AccountingCustomerParty."""

    id_type: str  # TipoIdFiscal: 31 NIT, 13 cédula…
    id_number: str
    dv: str
    person_type: str  # TipoOrganizacion: 1 legal, 2 natural
    legal_name: str
    trade_name: str = ''
    tax_responsibilities: tuple = ()
    tax_scheme: str = 'ZZ'
    address: Address | None = None
    email: str = ''
    phone: str = ''
    final_consumer: bool = False


def company_id(parent, prefixed_tag: str, party: Party):
    return sub(
        parent, prefixed_tag, party.id_number,
        schemeID=party.dv if party.id_type == '31' else None, schemeName=party.id_type, **DIAN_AGENCY,
    )


def address_block(parent, prefixed_tag: str, address: Address):
    """Address, RegistrationAddress or DeliveryAddress with DANE codes and Colombia."""
    node = sub(parent, prefixed_tag)
    sub(node, 'cbc:ID', address.municipality_code)
    sub(node, 'cbc:CityName', address.city_name)
    if address.postal_code:
        sub(node, 'cbc:PostalZone', address.postal_code)
    sub(node, 'cbc:CountrySubentity', address.department_name)
    sub(node, 'cbc:CountrySubentityCode', address.department_code)
    line = sub(node, 'cac:AddressLine')
    sub(line, 'cbc:Line', address.line)
    country = sub(node, 'cac:Country')
    sub(country, 'cbc:IdentificationCode', 'CO')
    sub(country, 'cbc:Name', 'Colombia', languageID='es')
    return node


def tax_scheme(parent, code: str):
    scheme = sub(parent, 'cac:TaxScheme')
    sub(scheme, 'cbc:ID', code)
    sub(scheme, 'cbc:Name', TAX_NAMES.get(code, code))
    return scheme


def party_block(parent, party: Party, *, is_issuer: bool, prefix: str = ''):
    """cac:Party for the issuer (with CorporateRegistrationScheme = prefix) or the buyer."""
    node = sub(parent, 'cac:Party')
    if not is_issuer:
        identification = sub(node, 'cac:PartyIdentification')
        company_id(identification, 'cbc:ID', party)
    name = sub(node, 'cac:PartyName')
    sub(name, 'cbc:Name', party.trade_name or party.legal_name)
    if party.address:
        location = sub(node, 'cac:PhysicalLocation')
        address_block(location, 'cac:Address', party.address)
    scheme = sub(node, 'cac:PartyTaxScheme')
    sub(scheme, 'cbc:RegistrationName', party.legal_name)
    company_id(scheme, 'cbc:CompanyID', party)
    # Several responsibilities go together, separated by ';' (FAK26).
    sub(scheme, 'cbc:TaxLevelCode', ';'.join(party.tax_responsibilities) or 'R-99-PN')
    if party.address:
        address_block(scheme, 'cac:RegistrationAddress', party.address)
    tax_scheme(scheme, party.tax_scheme)
    legal = sub(node, 'cac:PartyLegalEntity')
    sub(legal, 'cbc:RegistrationName', party.legal_name)
    company_id(legal, 'cbc:CompanyID', party)
    if is_issuer:
        registration = sub(legal, 'cac:CorporateRegistrationScheme')
        sub(registration, 'cbc:ID', prefix)
    if party.email or party.phone:
        contact = sub(node, 'cac:Contact')
        if party.phone:
            sub(contact, 'cbc:Telephone', party.phone)
        if party.email:
            sub(contact, 'cbc:ElectronicMail', party.email)
    return node


@dataclass(frozen=True)
class Tax:
    code: str  # 01 IVA, 04 INC
    rate: Decimal
    taxable_amount: Decimal
    amount: Decimal


@dataclass(frozen=True)
class AllowanceCharge:
    is_charge: bool
    reason: str
    amount: Decimal
    base_amount: Decimal
    reason_code: str = ''

    @property
    def code(self) -> str:
        return self.reason_code or (CHARGE_CODE if self.is_charge else ALLOWANCE_CODE)


def allowance_charge_block(parent, index: int, item: AllowanceCharge):
    node = sub(parent, 'cac:AllowanceCharge')
    sub(node, 'cbc:ID', index)
    sub(node, 'cbc:ChargeIndicator', 'true' if item.is_charge else 'false')
    sub(node, 'cbc:AllowanceChargeReasonCode', item.code)
    sub(node, 'cbc:AllowanceChargeReason', item.reason or ('Recargo' if item.is_charge else 'Descuento'))
    if item.base_amount:
        sub(node, 'cbc:MultiplierFactorNumeric', money(item.amount * 100 / item.base_amount))
    amount(node, 'cbc:Amount', item.amount)
    amount(node, 'cbc:BaseAmount', item.base_amount)
    return node


def tax_total_blocks(parent, taxes: list[Tax]):
    """One cac:TaxTotal per tax code with one cac:TaxSubtotal per rate (FAS01a, FAS04)."""
    by_code: dict[str, dict[Decimal, list[Tax]]] = {}
    for tax in taxes:
        by_code.setdefault(tax.code, {}).setdefault(tax.rate, []).append(tax)
    for code, rates in by_code.items():
        total = sub(parent, 'cac:TaxTotal')
        amount(total, 'cbc:TaxAmount', sum((t.amount for group in rates.values() for t in group), Decimal(0)))
        for rate, group in rates.items():
            subtotal = sub(total, 'cac:TaxSubtotal')
            amount(subtotal, 'cbc:TaxableAmount', sum((t.taxable_amount for t in group), Decimal(0)))
            amount(subtotal, 'cbc:TaxAmount', sum((t.amount for t in group), Decimal(0)))
            category = sub(subtotal, 'cac:TaxCategory')
            sub(category, 'cbc:Percent', money(rate))
            tax_scheme(category, code)


@dataclass(frozen=True)
class Line:
    number: int
    code: str
    description: str
    quantity: Decimal
    unit_code: str
    unit_price: Decimal
    line_extension: Decimal
    taxes: tuple = ()
    allowances: tuple = ()
    charges: tuple = ()


@dataclass(frozen=True)
class Totals:
    line_extension: Decimal
    tax_exclusive: Decimal
    tax_inclusive: Decimal
    allowance_total: Decimal
    charge_total: Decimal
    rounding: Decimal
    payable: Decimal


@dataclass(frozen=True)
class Software:
    software_id: str
    pin: str


@dataclass(frozen=True)
class Resolution:
    number: str
    valid_from: str
    valid_to: str
    prefix: str
    number_from: int
    number_to: int
    technical_key: str


@dataclass(frozen=True)
class Payment:
    form: str  # FormasPago: 1 contado, 2 crédito
    means: tuple  # MediosPago codes
    due_date: str = ''


@dataclass
class DocumentSpec:
    """Everything needed to build one DIAN document; produced from a Fiscal. document by the emission service."""

    environment: str
    prefix: str
    number: int
    issue_date: str
    issue_time: str
    issuer: Party
    buyer: Party
    software: Software
    lines: list
    totals: Totals
    payment: Payment
    allowances: list = field(default_factory=list)
    charges: list = field(default_factory=list)
    notes: list = field(default_factory=list)
    delivery_address: Address | None = None
    operation_type: str = '10'
    currency: str = 'COP'

    @property
    def full_number(self) -> str:
        return f'{self.prefix}{self.number}'

    @property
    def taxes(self) -> list[Tax]:
        return [tax for line in self.lines for tax in line.taxes]

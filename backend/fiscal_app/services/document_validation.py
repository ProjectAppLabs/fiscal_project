"""Prior validation of the commercial document a client system sends (contract v1, docs/fiscal/contrato.md).

It checks what the DIAN would reject, before building any XML, with the rules of the annex FE 1.9 (rule codes in
`rule`) and the official code lists (dian.catalogs). Every problem is collected, so the client can fix them at once.
Amounts follow the annex: round-half-to-even and a tolerance of +/- 2.00 (+/- 5.00 for IVA amounts).
"""

import re
from dataclasses import dataclass, field
from decimal import Decimal

from dian.catalogs import code_list, is_valid, tax_rates
from dian.money import IVA_TOLERANCE, MONEY_TOLERANCE, round_money, to_decimal, within
from fiscal_app.services.nit import check_digit

FINAL_CONSUMER = {
    'final_consumer': True,
    'id_type': '13',
    'id_number': '222222222222',
    'person_type': '2',
    'name': 'Consumidor final',
    'tax_responsibilities': ['R-99-PN'],
    'tax_scheme': 'ZZ',
}
# Taxes supported in stage 1 (restaurants): IVA and INC. Other tributes arrive in stage 2.
SUPPORTED_TAXES = ('01', '04')
BUYER_TAX_SCHEMES = ('01', '04', 'ZZ')
FINAL_CONSUMER_RESPONSIBILITY = 'R-99-PN'
# Ley 1935 de 2018: the suggested tip cannot exceed 10 % of the bill.
TIP_LIMIT = Decimal('0.10')
OPERATION_TYPES = {
    'invoice': ('TipoOperacionF', '10'),
    'credit_note': ('TipoOperacionNC', '20'),
    'debit_note': ('TipoOperacionND', '30'),
}
# Stage 1 issues notes that reference a Fiscal. invoice; legacy Decreto 2242 types are refused.
REFERENCING_NOTE_TYPES = ('20', '30')


@dataclass
class Problem:
    path: str
    code: str
    message: str
    rule: str = ''

    def as_dict(self):
        data = {'path': self.path, 'code': self.code, 'message': self.message}
        if self.rule:
            data['rule'] = self.rule
        return data


@dataclass
class Checker:
    problems: list = field(default_factory=list)

    def add(self, path, code, message, rule=''):
        self.problems.append(Problem(path, code, message, rule))

    def money(self, data, key, path, *, required=True, allow_zero=True):
        """Read a non-negative amount; record a problem and return None when it is missing or invalid."""
        raw = data.get(key) if isinstance(data, dict) else None
        if raw is None:
            if required:
                self.add(path, 'required', 'Falta este valor.')
            return None
        value = to_decimal(raw)
        if value is None:
            self.add(path, 'invalid_amount', 'Debe ser un número.')
            return None
        if value < 0:
            self.add(path, 'negative_amount', 'No se permiten valores negativos.')
            return None
        if not allow_zero and value == 0:
            self.add(path, 'zero_amount', 'Debe ser mayor que cero.')
            return None
        return value


def _text(value, max_length):
    return isinstance(value, str) and 0 < len(value.strip()) <= max_length


def validate_document(kind: str, document: dict, *, issue_date=None) -> tuple[dict, list[Problem]]:
    """Return the normalized document and the list of problems (empty when the DIAN would accept it)."""
    check = Checker()
    if not isinstance(document, dict):
        check.add('document', 'invalid_document', 'Falta el documento comercial.')
        return {}, check.problems
    normalized = {}
    normalized['currency'] = _currency(check, document)
    normalized['operation_type'] = _operation_type(check, kind, document)
    normalized['buyer'] = _buyer(check, document.get('buyer'))
    normalized['sale_channel'], normalized['delivery'] = _delivery(check, document, normalized['buyer'])
    lines = _lines(check, document.get('lines'))
    normalized['lines'] = lines
    normalized['allowances'] = _adjustments(check, document.get('allowances', []), 'allowances')
    normalized['charges'] = _adjustments(check, document.get('charges', []), 'charges')
    normalized['totals'] = _totals(check, document.get('totals'), lines, normalized)
    normalized['payment'] = _payment(check, document.get('payment'), issue_date)
    normalized['billing_reference'] = _billing_reference(check, kind, document.get('billing_reference'))
    normalized['notes'] = [note for note in document.get('notes', []) if isinstance(note, str)][:10]
    return normalized, check.problems


def _currency(check, document):
    currency = document.get('currency', 'COP')
    if not is_valid('TipoMoneda', currency):
        check.add('currency', 'invalid_currency', 'La moneda no está en la lista de la DIAN.', 'FAD15')
    elif currency != 'COP':
        check.add('currency', 'unsupported_currency', 'Por ahora Fiscal. solo emite en pesos colombianos (COP).')
    return currency


def _operation_type(check, kind, document):
    list_name, default = OPERATION_TYPES[kind]
    operation_type = document.get('operation_type', default)
    if not is_valid(list_name, operation_type):
        check.add('operation_type', 'invalid_operation_type', 'El tipo de operación no está en la lista de la DIAN.')
    elif kind != 'invoice' and operation_type not in REFERENCING_NOTE_TYPES:
        check.add(
            'operation_type', 'unsupported_operation_type',
            'Por ahora las notas deben referenciar una factura emitida con Fiscal. (tipo 20 o 30).',
        )
    return operation_type


def _buyer(check, buyer):
    if not isinstance(buyer, dict):
        check.add('buyer', 'required', 'Falta el adquirente. Usa {"final_consumer": true} para consumidor final.')
        return {}
    if buyer.get('final_consumer') is True:
        # Annex FE 1.9, FAK62/FAK26: 222222222222, document type 13 and responsibility R-99-PN.
        return dict(FINAL_CONSUMER)
    normalized = {'final_consumer': False}
    id_type = buyer.get('id_type')
    id_number = str(buyer.get('id_number', '')).strip()
    if not is_valid('TipoIdFiscal', str(id_type)):
        check.add('buyer.id_type', 'invalid_id_type', 'El tipo de documento no está en la lista de la DIAN.', 'FAK63')
    elif id_type in ('13', '31') and not re.fullmatch(r'[0-9]{3,15}', id_number):
        check.add('buyer.id_number', 'invalid_id_number', 'El número de documento solo lleva dígitos, sin puntos.')
    elif not re.fullmatch(r'[A-Za-z0-9-]{1,20}', id_number):
        check.add('buyer.id_number', 'invalid_id_number', 'El número de documento no es válido.')
    elif id_type == '31' and str(buyer.get('dv', '')) != check_digit(id_number):
        check.add('buyer.dv', 'invalid_dv', 'El dígito de verificación no corresponde al NIT del adquirente.', 'FAK64')
    normalized.update({'id_type': id_type, 'id_number': id_number})
    if id_type == '31':
        normalized['dv'] = str(buyer.get('dv', ''))
    person_type = str(buyer.get('person_type', ''))
    if not is_valid('TipoOrganizacion', person_type):
        check.add('buyer.person_type', 'invalid_person_type', 'Indica 1 (persona jurídica) o 2 (persona natural).')
    normalized['person_type'] = person_type
    if not _text(buyer.get('name'), 450):
        check.add('buyer.name', 'required', 'Falta el nombre o la razón social del adquirente.')
    normalized['name'] = (buyer.get('name') or '').strip()
    responsibilities = [str(code).upper() for code in buyer.get('tax_responsibilities') or [FINAL_CONSUMER_RESPONSIBILITY]]
    valid = set(code_list('TipoResponsabilidad')) | {FINAL_CONSUMER_RESPONSIBILITY}
    if any(code not in valid for code in responsibilities):
        check.add(
            'buyer.tax_responsibilities', 'invalid_tax_responsibility',
            'Usa las responsabilidades de la lista de la DIAN (por ejemplo O-13, ZZ o R-99-PN).', 'FAK26',
        )
    normalized['tax_responsibilities'] = responsibilities
    tax_scheme = buyer.get('tax_scheme', 'ZZ')
    if tax_scheme not in BUYER_TAX_SCHEMES:
        check.add('buyer.tax_scheme', 'invalid_tax_scheme', 'El tributo del adquirente debe ser 01, 04 o ZZ.')
    normalized['tax_scheme'] = tax_scheme
    email = buyer.get('email', '')
    if email and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email):
        check.add('buyer.email', 'invalid_email', 'El correo del adquirente no es válido.')
    normalized['email'] = email
    if buyer.get('address') is not None:
        normalized['address'] = _address(check, buyer['address'], 'buyer.address')
    return normalized


def _address(check, address, path):
    if not isinstance(address, dict):
        check.add(path, 'invalid_address', 'La dirección debe traer la línea y el municipio.')
        return {}
    if not _text(address.get('line'), 300):
        check.add(f'{path}.line', 'required', 'Falta la dirección.')
    municipality = str(address.get('municipality_code', ''))
    if not is_valid('Municipio', municipality):
        check.add(f'{path}.municipality_code', 'invalid_municipality', 'El municipio no está en la lista DANE de la DIAN.')
    return {'line': (address.get('line') or '').strip(), 'municipality_code': municipality}


def _delivery(check, document, buyer):
    channel = document.get('sale_channel', 'on_site')
    if channel not in ('on_site', 'delivery'):
        check.add('sale_channel', 'invalid_sale_channel', 'Usa on_site (en el local) o delivery (domicilio).')
        return channel, None
    delivery = document.get('delivery_address')
    # Res. 000227 de 2025 art. 1.5.1.2.2.1 num. 3: a sale outside the premises to a final consumer or to a person
    # identified with a cédula must carry the delivery address.
    needs_address = channel == 'delivery' and (buyer.get('final_consumer') or buyer.get('id_type') == '13')
    if delivery is None:
        if needs_address:
            check.add(
                'delivery_address', 'delivery_address_required',
                'Un domicilio a consumidor final o a una persona con cédula debe llevar la dirección de entrega.',
            )
        return channel, None
    return channel, _address(check, delivery, 'delivery_address')


def _lines(check, lines):
    if not isinstance(lines, list) or not lines:
        check.add('lines', 'required', 'El documento debe tener al menos una línea.', 'FAV01')
        return []
    if len(lines) > 500:
        check.add('lines', 'too_many_lines', 'Un documento admite hasta 500 líneas.')
        return []
    return [_line(check, line, f'lines[{index}]', index + 1) for index, line in enumerate(lines)]


def _line(check, line, path, number):
    if not isinstance(line, dict):
        check.add(path, 'invalid_line', 'Cada línea debe ser un objeto.')
        return {}
    if not _text(line.get('description'), 300):
        check.add(f'{path}.description', 'required', 'Falta la descripción de la línea.')
    quantity = check.money(line, 'quantity', f'{path}.quantity', allow_zero=False)
    if quantity is None and line.get('quantity') is not None and to_decimal(line['quantity']) is not None:
        check.problems[-1].rule = 'FAV04b'
    unit_code = str(line.get('unit_code', '94'))
    if not is_valid('UnidadesMedida', unit_code):
        check.add(f'{path}.unit_code', 'invalid_unit_code', 'La unidad no está en la lista de la DIAN (94 = unidad).', 'FAV05')
    unit_price = check.money(line, 'unit_price', f'{path}.unit_price')
    allowances = _adjustments(check, line.get('allowances', []), f'{path}.allowances')
    charges = _adjustments(check, line.get('charges', []), f'{path}.charges')
    line_extension = check.money(line, 'line_extension', f'{path}.line_extension')
    if None not in (quantity, unit_price, line_extension):
        expected = round_money(quantity * unit_price) - _sum(allowances) + _sum(charges)
        if not within(expected, line_extension):
            check.add(
                f'{path}.line_extension', 'line_extension_mismatch',
                f'El valor de la línea debe ser cantidad × precio − descuentos + cargos ({round_money(expected)}).',
                'FAV06',
            )
    taxes = _line_taxes(check, line.get('taxes', []), f'{path}.taxes', line_extension)
    return {
        'number': number,
        'code': str(line.get('code', ''))[:50],
        'description': (line.get('description') or '').strip(),
        'quantity': str(quantity) if quantity is not None else None,
        'unit_code': unit_code,
        'unit_price': _str(unit_price),
        'allowances': allowances,
        'charges': charges,
        'line_extension': _str(line_extension),
        'taxes': taxes,
    }


def _line_taxes(check, taxes, path, line_extension):
    if not isinstance(taxes, list):
        check.add(path, 'invalid_taxes', 'Los impuestos de la línea deben ser una lista.')
        return []
    seen, normalized = set(), []
    for index, tax in enumerate(taxes):
        tax_path = f'{path}[{index}]'
        if not isinstance(tax, dict):
            check.add(tax_path, 'invalid_tax', 'Cada impuesto debe ser un objeto.')
            continue
        code = str(tax.get('code', ''))
        if not is_valid('TipoImpuesto', code):
            check.add(f'{tax_path}.code', 'invalid_tax_code', 'El tributo no está en la lista de la DIAN.', 'FAX16')
            continue
        if code not in SUPPORTED_TAXES:
            check.add(f'{tax_path}.code', 'unsupported_tax', 'Por ahora Fiscal. emite IVA (01) e INC (04).')
            continue
        if code in seen:
            check.add(f'{tax_path}.code', 'duplicate_tax', 'Un tributo aparece una sola vez por línea.', 'FAS01a')
        seen.add(code)
        rate = to_decimal(tax.get('rate'))
        rate_text = f'{rate:.2f}' if rate is not None else ''
        if rate_text not in tax_rates(code):
            check.add(f'{tax_path}.rate', 'invalid_tax_rate', 'La tarifa no está en la lista de la DIAN para ese tributo.')
        taxable = check.money(tax, 'taxable_amount', f'{tax_path}.taxable_amount')
        amount = check.money(tax, 'amount', f'{tax_path}.amount')
        if taxable is not None and line_extension is not None and not within(taxable, line_extension):
            check.add(
                f'{tax_path}.taxable_amount', 'taxable_amount_mismatch',
                'La base del impuesto debe ser el valor de la línea (la propina nunca entra en la base).',
            )
        if None not in (rate, taxable, amount):
            expected = round_money(taxable * rate / 100)
            tolerance = IVA_TOLERANCE if code == '01' else MONEY_TOLERANCE
            if not within(expected, amount, tolerance):
                check.add(
                    f'{tax_path}.amount', 'tax_amount_mismatch',
                    f'El impuesto debe ser base × tarifa ({expected}).', 'FAS07',
                )
        normalized.append({'code': code, 'rate': rate_text, 'taxable_amount': _str(taxable), 'amount': _str(amount)})
    return normalized


def _adjustments(check, items, path):
    if not isinstance(items, list):
        check.add(path, 'invalid_adjustments', 'Debe ser una lista.')
        return []
    normalized = []
    for index, item in enumerate(items):
        item_path = f'{path}[{index}]'
        if not isinstance(item, dict):
            check.add(item_path, 'invalid_adjustment', 'Cada descuento o cargo debe ser un objeto.')
            continue
        amount = check.money(item, 'amount', f'{item_path}.amount', allow_zero=False)
        entry = {'reason': str(item.get('reason', ''))[:200], 'amount': _str(amount)}
        if 'kind' in item:
            entry['kind'] = item['kind']
        normalized.append(entry)
    return normalized


def _totals(check, totals, lines, normalized):
    if not isinstance(totals, dict):
        check.add('totals', 'required', 'Faltan los totales del documento.', 'FAU01')
        return {}
    given = {key: check.money(totals, key, f'totals.{key}') for key in (
        'line_extension', 'tax_exclusive', 'tax_inclusive', 'payable')}
    given['allowance_total'] = check.money(totals, 'allowance_total', 'totals.allowance_total', required=False) or Decimal(0)
    given['charge_total'] = check.money(totals, 'charge_total', 'totals.charge_total', required=False) or Decimal(0)
    rounding = to_decimal(totals.get('rounding', 0)) or Decimal(0)
    line_extension = _sum(lines, 'line_extension')
    tax_exclusive = sum((_dec(line['taxes'][0]['taxable_amount']) for line in lines if line.get('taxes')), Decimal(0))
    taxes = sum((_dec(tax['amount']) for line in lines for tax in line.get('taxes', [])), Decimal(0))
    allowance_total = _sum(normalized['allowances'])
    charge_total = _sum(normalized['charges'])
    expected = {
        'line_extension': (line_extension, 'FAU02', 'la suma de los valores de las líneas'),
        'tax_exclusive': (tax_exclusive, 'FAU04', 'la suma de las bases imponibles de las líneas'),
        'tax_inclusive': (line_extension + taxes, 'FAU06', 'el valor bruto más los tributos'),
        'allowance_total': (allowance_total, 'FAU08', 'la suma de los descuentos globales'),
        'charge_total': (charge_total, 'FAU10', 'la suma de los cargos globales'),
    }
    for key, (value, rule, meaning) in expected.items():
        if given.get(key) is not None and not within(value, given[key]):
            check.add(f'totals.{key}', f'{key}_mismatch', f'Debe ser {meaning} ({round_money(value)}).', rule)
    if given.get('tax_inclusive') is not None and given.get('payable') is not None:
        payable = given['tax_inclusive'] - given['allowance_total'] + given['charge_total'] + rounding
        if not within(payable, given['payable']):
            check.add(
                'totals.payable', 'payable_mismatch',
                f'Debe ser bruto con tributos − descuentos + cargos ({round_money(payable)}).', 'FAU14',
            )
    tips = sum((_dec(item['amount']) for item in normalized['charges'] if item.get('kind') == 'tip'), Decimal(0))
    if tips and tips > round_money(line_extension * TIP_LIMIT) + MONEY_TOLERANCE:
        check.add('charges', 'tip_above_limit', 'La propina no puede superar el 10 % del consumo (Ley 1935 de 2018).')
    result = {key: _str(value) for key, value in given.items()}
    result['rounding'] = _str(rounding)
    return result


def _payment(check, payment, issue_date):
    if not isinstance(payment, dict):
        check.add('payment', 'required', 'Falta la forma y el medio de pago.', 'FAN01')
        return {}
    form = str(payment.get('form', '1'))
    if not is_valid('FormasPago', form):
        check.add('payment.form', 'invalid_payment_form', 'Indica 1 (contado) o 2 (crédito).', 'FAN02')
    due_date = payment.get('due_date')
    if form == '2' and not due_date:
        check.add('payment.due_date', 'due_date_required', 'Un pago a crédito debe traer la fecha de vencimiento.', 'FAN04')
    if due_date and issue_date and str(due_date) < issue_date.isoformat():
        check.add('payment.due_date', 'due_date_before_issue', 'El vencimiento no puede ser anterior a la emisión.')
    means = payment.get('means')
    if not isinstance(means, list) or not means:
        check.add('payment.means', 'required', 'Indica al menos un medio de pago (10 efectivo, 48 tarjeta…).', 'FAN03')
        means = []
    for index, code in enumerate(means):
        if not is_valid('MediosPago', str(code)):
            check.add(
                f'payment.means[{index}]', 'invalid_payment_means', 'El medio de pago no está en la lista de la DIAN.', 'FAN03'
            )
    return {'form': form, 'means': [str(code) for code in means], 'due_date': due_date}


def _billing_reference(check, kind, reference):
    if kind == 'invoice':
        return None
    document_id = reference.get('document_id') if isinstance(reference, dict) else None
    if isinstance(document_id, bool) or not isinstance(document_id, int) or document_id < 1:
        check.add(
            'billing_reference.document_id', 'reference_required',
            'La nota debe referenciar, con su id en Fiscal., la factura que corrige.',
        )
        return None
    list_name = 'ConceptoNotaCredito' if kind == 'credit_note' else 'ConceptoNotaDebito'
    concept = str(reference.get('concept_code', ''))
    if not is_valid(list_name, concept):
        check.add(
            'billing_reference.concept_code', 'invalid_concept',
            'El concepto de corrección no está en la lista de la DIAN (por ejemplo 2 = anulación).',
        )
    return {'document_id': reference['document_id'], 'concept_code': concept, 'reason': str(reference.get('reason', ''))[:500]}


def _sum(items, key='amount'):
    return sum((_dec(item.get(key)) for item in items if isinstance(item, dict)), Decimal(0))


def _dec(value):
    return to_decimal(value) or Decimal(0)


def _str(value):
    return None if value is None else str(round_money(value))

"""DIAN code lists (genericode files from the official toolkit, see resources/README.md)."""

import xml.etree.ElementTree as ET
from functools import cache
from pathlib import Path

GENERICODE_DIR = Path(__file__).resolve().parent / 'resources' / 'genericode'


@cache
def code_list(name: str) -> dict[str, str]:
    """Return {code: name} of a list, e.g. code_list('TipoIdFiscal')['13'] == 'Cédula de ciudadanía'."""
    tree = ET.parse(GENERICODE_DIR / f'{name}-2.1.gc')
    codes = {}
    for row in tree.iter('Row'):
        values = {value.get('ColumnRef'): (value.findtext('SimpleValue') or '').strip() for value in row.findall('Value')}
        codes[values['code']] = values.get('name', '')
    return codes


def is_valid(name: str, code: str) -> bool:
    return code in code_list(name)


def tax_rates(tax_code: str) -> set[str]:
    """Allowed rates (as 'NN.NN' strings) of IVA (01) or INC (04); empty for other taxes."""
    lists = {'01': 'TarifaImpuestoIVA', '04': 'TarifaImpuestoINC'}
    return set(code_list(lists[tax_code])) if tax_code in lists else set()


# Annex FE 1.9, table 13.2.6.1 («Tablas Referenciadas» of the toolkit), which rule FAJ26/FAK26 validates. The
# genericode TipoResponsabilidad-2.1 of the same toolkit still lists ZZ instead of R-99-PN, and the DIAN rejects ZZ
# in habilitación (confirmed 2026-10-13), so this table, not the genericode, is the source.
RESPONSIBILITIES = {
    'O-13': 'Gran contribuyente',
    'O-15': 'Autorretenedor',
    'O-23': 'Agente de retención IVA',
    'O-47': 'Régimen simple de tributación',
    'R-99-PN': 'No aplica – Otros',
}
NO_RESPONSIBILITY = 'R-99-PN'


def responsibilities(codes) -> list[str]:
    """Normalize declared responsibilities: upper case, the legacy ZZ becomes R-99-PN, and none means R-99-PN."""
    normalized = [NO_RESPONSIBILITY if code == 'ZZ' else code for code in (str(c).strip().upper() for c in codes or ())]
    return list(dict.fromkeys(normalized)) or [NO_RESPONSIBILITY]


# Table 13.3.8: AllowanceChargeReason must be the name of its code (rule FAQ04a, confirmed in habilitación).
ALLOWANCE_CHARGE_REASONS = {
    '00': 'Descuento no condicionado',
    '01': 'Descuento condicionado',
    '02': 'Recargo no condicionado',
    '03': 'Recargo condicionado',
}

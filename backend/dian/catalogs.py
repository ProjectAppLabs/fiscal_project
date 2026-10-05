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

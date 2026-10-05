"""Validation against the official UBL 2.1 XSD of the DIAN toolkit (resources/xsd), including DianExtensions.

UBLExtensions accept any content with processContents="lax": the DIAN structures schema is loaded together with the
document schema so sts:DianExtensions is validated too, not skipped.
"""

from functools import cache
from pathlib import Path

from lxml import etree

XSD_DIR = Path(__file__).resolve().parent / 'resources' / 'xsd'
DOCUMENT_SCHEMAS = {
    'Invoice': 'maindoc/UBL-Invoice-2.1.xsd',
    'CreditNote': 'maindoc/UBL-CreditNote-2.1.xsd',
    'DebitNote': 'maindoc/UBL-DebitNote-2.1.xsd',
}
NAMESPACES = {
    'Invoice': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    'CreditNote': 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
    'DebitNote': 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2',
}


@cache
def schema(document: str) -> etree.XMLSchema:
    """Schema of a document type that imports both the UBL document and the DIAN structures."""
    wrapper = f'''<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:import namespace="{NAMESPACES[document]}" schemaLocation="{(XSD_DIR / DOCUMENT_SCHEMAS[document]).as_uri()}"/>
  <xsd:import namespace="dian:gov:co:facturaelectronica:Structures-2-1"
              schemaLocation="{(XSD_DIR / 'maindoc' / 'DIAN_UBL_Structures.xsd').as_uri()}"/>
</xsd:schema>'''
    return etree.XMLSchema(etree.fromstring(wrapper.encode()))


# Known inconsistency of the official toolkit: DIAN_UBL_Structures.xsd types sts:ProviderID and
# sts:AuthorizationProviderID as coID2Type, whose schemeID enumerates document types (11, 13, 31…), while the annex
# FE 1.9 (FAB22) and every official example put the NIT check digit there. Only this error is ignored. (Some older
# examples also carry a pre-1.9 QRCode text and fail on it; the current QRCode is the lookup URL, FAB36.)
KNOWN_TOOLKIT_INCONSISTENCIES = (
    "Element '{dian:gov:co:facturaelectronica:Structures-2-1}ProviderID', attribute 'schemeID': [facet 'enumeration']",
    "Element '{dian:gov:co:facturaelectronica:Structures-2-1}AuthorizationProviderID', attribute 'schemeID': "
    "[facet 'enumeration']",
)


def errors(root: etree._Element) -> list[str]:
    """XSD errors of a document; empty when it is valid (known toolkit inconsistencies excluded)."""
    document = etree.QName(root).localname
    validator = schema(document)
    if validator.validate(root):
        return []
    return [
        f'línea {error.line}: {error.message}' for error in validator.error_log
        if not error.message.startswith(KNOWN_TOOLKIT_INCONSISTENCIES)
    ]

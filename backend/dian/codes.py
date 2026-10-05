"""Unique codes of the DIAN annex FE 1.9: CUFE, CUDE, software security code and QR.

* CUFE (§11.2) = SHA-384(NumFac + FecFac + HorFac + ValFac + "01" + ValImp1 + "04" + ValImp2 + "03" + ValImp3
  + ValTot + NitOFE + NumAdq + ClTec + TipoAmbiente). Amounts with two decimals TRUNCATED, no thousands separator.
* CUDE (§11.4) is the same string with the software PIN instead of the technical key (notes, contingency type 03).
* SoftwareSecurityCode (§11.8) = SHA-384(software id + PIN + document number).
* QR (§11.7): the document data plus the CUFE and the DIAN lookup URL of the environment.

Both annex examples (§11.2.1 and the type-03 CUDE of §11.4) are reproduced byte for byte in the tests.
"""

import hashlib
from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal

QR_LOOKUP = {
    '1': 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=',
    '2': 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=',
}


def truncated(amount) -> str:
    """Two decimals truncated (not rounded), as the CUFE string requires: 262.569 -> '262.56'."""
    return str(Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_DOWN))


@dataclass(frozen=True)
class CodeInput:
    """The document values that enter the CUFE/CUDE string."""

    number: str  # prefix + consecutive, e.g. SETP990000001
    issue_date: str  # YYYY-MM-DD
    issue_time: str  # HH:MM:SS-05:00
    line_extension: Decimal  # ValFac: value without taxes
    iva: Decimal  # tax 01
    inc: Decimal  # tax 04
    ica: Decimal  # tax 03
    payable: Decimal  # ValTot
    issuer_nit: str  # without check digit
    buyer_id: str  # without check digit
    environment: str  # '1' production, '2' testing


def _chain(data: CodeInput, secret: str) -> str:
    return (
        data.number + data.issue_date + data.issue_time + truncated(data.line_extension)
        + '01' + truncated(data.iva) + '04' + truncated(data.inc) + '03' + truncated(data.ica)
        + truncated(data.payable) + data.issuer_nit + data.buyer_id + secret + data.environment
    )


def cufe(data: CodeInput, technical_key: str) -> str:
    """CUFE of an invoice (§11.2), with the technical key of its numbering range."""
    return hashlib.sha384(_chain(data, technical_key).encode()).hexdigest()


def cude(data: CodeInput, software_pin: str) -> str:
    """CUDE of a credit/debit note or a contingency type-03 invoice (§11.4), with the software PIN."""
    return hashlib.sha384(_chain(data, software_pin).encode()).hexdigest()


def software_security_code(software_id: str, software_pin: str, document_number: str) -> str:
    """Fingerprint of the software that produced the document (§11.8)."""
    return hashlib.sha384((software_id + software_pin + document_number).encode()).hexdigest()


def qr_url(code: str, environment: str) -> str:
    """DIAN lookup URL of a CUFE/CUDE in the given environment."""
    return QR_LOOKUP[environment] + code


def qr_text(data: CodeInput, code: str, other_taxes: Decimal) -> str:
    """Content of the QR (§11.7): document data, CUFE and lookup URL, one 'Field: value' per line."""
    return '\n'.join([
        f'NumFac: {data.number}',
        f'FecFac: {data.issue_date}',
        f'HorFac: {data.issue_time}',
        f'NitFac: {data.issuer_nit}',
        f'DocAdq: {data.buyer_id}',
        f'ValFac: {truncated(data.line_extension)}',
        f'ValIva: {truncated(data.iva)}',
        f'ValOtroIm: {truncated(other_taxes)}',
        f'ValTolFac: {truncated(data.payable)}',
        f'CUFE: {code}',
        qr_url(code, data.environment),
    ])

"""Issuer certificates: validated when loaded, stored encrypted, one active per issuer."""

import base64
import binascii
from dataclasses import dataclass
from datetime import datetime

from cryptography.hazmat.primitives.serialization import pkcs12
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from dian import signing
from fiscal_app.models import Certificate, Issuer


@dataclass(frozen=True)
class CertificateInfo:
    subject: str
    issued_by: str
    serial: str
    not_before: datetime
    not_after: datetime


def inspect_p12(raw: bytes, password: str) -> CertificateInfo:
    """Open a .p12 and return its public data. Error messages never repeat the password or the file."""
    try:
        key, cert, _chain = pkcs12.load_key_and_certificates(raw, password.encode())
    except ValueError as exc:
        raise ValidationError(
            'No se pudo abrir el certificado: revisa el archivo y la contraseña.', code='invalid_certificate'
        ) from exc
    if key is None or cert is None:
        raise ValidationError('El archivo no trae la llave privada y el certificado.', code='invalid_certificate')
    try:
        signing.check_certificate(signing.SigningCredentials(key, cert, ()))
    except signing.SigningError as exc:
        raise ValidationError(str(exc), code='invalid_certificate') from exc
    return CertificateInfo(
        subject=cert.subject.rfc4514_string()[:500],
        issued_by=cert.issuer.rfc4514_string()[:500],
        serial=format(cert.serial_number, 'x'),
        not_before=cert.not_valid_before_utc,
        not_after=cert.not_valid_after_utc,
    )


def decode_p12(p12_base64: str) -> bytes:
    try:
        return base64.b64decode(p12_base64 or '', validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValidationError('El certificado debe venir en base64.', code='invalid_certificate') from exc


@transaction.atomic
def set_certificate(issuer: Issuer, p12_base64: str, password: str) -> Certificate:
    """Validate and store a new certificate as the only active one of the issuer."""
    raw = decode_p12(p12_base64)
    info = inspect_p12(raw, password)
    if info.not_after <= timezone.now():
        raise ValidationError('El certificado ya venció.', code='certificate_expired')
    # Lock the issuer row so two concurrent uploads cannot both stay active (MySQL ignores conditional uniques).
    Issuer.objects.select_for_update().get(pk=issuer.pk)
    issuer.certificates.filter(active=True).update(active=False)
    return Certificate.objects.create(
        issuer=issuer,
        p12=base64.b64encode(raw).decode(),
        password=password,
        subject=info.subject,
        issued_by=info.issued_by,
        serial=info.serial,
        not_before=info.not_before,
        not_after=info.not_after,
    )


def active_certificate(issuer: Issuer) -> Certificate | None:
    return issuer.certificates.filter(active=True).order_by('-created_at').first()


def credentials_of(certificate: Certificate) -> signing.SigningCredentials:
    """Key, certificate and chain to sign with, decrypted only in memory."""
    return signing.load_pkcs12(base64.b64decode(certificate.p12), certificate.password)

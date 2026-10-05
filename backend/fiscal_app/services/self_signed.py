"""Self-signed .p12 certificates for development, fake data and tests. The DIAN never accepts them.

They declare the key usage the DIAN requires (Digital Signature and Non Repudiation, annex FE 1.9 §10.14) so the
local signature goes through the same checks as a real certificate.
"""

import base64
from datetime import UTC, datetime, timedelta

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import BestAvailableEncryption, pkcs12
from cryptography.x509.oid import NameOID

SIGNING_KEY_USAGE = x509.KeyUsage(
    digital_signature=True, content_commitment=True, key_encipherment=False, data_encipherment=False,
    key_agreement=False, key_cert_sign=False, crl_sign=False, encipher_only=False, decipher_only=False,
)


def self_signed_p12(common_name: str, password: str, days: int = 365) -> str:
    """Return a base64 .p12 with an RSA key and a self-signed certificate valid for `days` (negative: expired)."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
    now = datetime.now(UTC)
    not_before = now - timedelta(days=2) if days > 0 else now + timedelta(days=days - 2)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(not_before)
        .not_valid_after(now + timedelta(days=days))
        .add_extension(SIGNING_KEY_USAGE, critical=True)
        .sign(key, hashes.SHA256())
    )
    raw = pkcs12.serialize_key_and_certificates(
        b'fiscal-dev', key, certificate, None, BestAvailableEncryption(password.encode())
    )
    return base64.b64encode(raw).decode()

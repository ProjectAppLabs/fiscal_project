"""Encryption at rest with the Fernet key that only Fiscal. holds (FISCAL_ENCRYPTION_KEY)."""

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class DecryptionError(Exception):
    """A stored secret could not be decrypted. The message never includes the ciphertext or the plaintext."""


def _fernet():
    return Fernet(settings.FISCAL_ENCRYPTION_KEY.encode())


def encrypt(plaintext: str) -> str:
    """Encrypt a text value and return the Fernet token as text."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    """Decrypt a Fernet token produced by `encrypt`."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise DecryptionError('A stored secret could not be decrypted; check FISCAL_ENCRYPTION_KEY.') from exc

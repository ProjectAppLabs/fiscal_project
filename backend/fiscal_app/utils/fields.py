"""Model fields shared by the Fiscal. models."""

from django.db import models

from .crypto import decrypt, encrypt


class EncryptedTextField(models.TextField):
    """Stores the value encrypted with Fernet; Python code reads and writes plain text.

    Use it for every secret: client secrets, .p12 certificates (base64), certificate passwords,
    software PINs and technical keys. Encrypted values cannot be filtered or ordered in the database.
    """

    def from_db_value(self, value, expression, connection):
        if value in (None, ''):
            return value
        return decrypt(value)

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value in (None, ''):
            return value
        return encrypt(value)


class ExactCharField(models.CharField):
    """CharField compared byte by byte on MySQL (utf8mb4_bin), so 'Key' and 'key' are different values.

    MySQL's default collation is case-insensitive; keys, tokens and idempotency keys must not be. The collation is
    only applied on MySQL because SQLite (used by the fast test suite) does not know `utf8mb4_bin` and is already
    case-sensitive.
    """

    def db_parameters(self, connection):
        params = super().db_parameters(connection)
        if connection.vendor == 'mysql':
            params['collation'] = 'utf8mb4_bin'
        return params

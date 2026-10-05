"""HMAC request signing shared by Fiscal. and its client systems, in both directions (requests and webhooks).

Headers:
    X-Fiscal-Key        public key id of the client system
    X-Fiscal-Timestamp  Unix seconds when the request was signed
    X-Fiscal-Signature  hex(HMAC-SHA256(secret, canonical text))

Canonical text: timestamp, upper-case method, path with its query string and the SHA-256 hex of the exact body,
joined by newlines. Client systems (Waiter) implement exactly this function.
"""

import hashlib
import hmac
import time

KEY_HEADER = 'X-Fiscal-Key'
TIMESTAMP_HEADER = 'X-Fiscal-Timestamp'
SIGNATURE_HEADER = 'X-Fiscal-Signature'


def canonical_text(timestamp: str, method: str, path: str, body: bytes) -> bytes:
    return '\n'.join([timestamp, method.upper(), path, hashlib.sha256(body).hexdigest()]).encode()


def sign(secret: str, timestamp: str, method: str, path: str, body: bytes) -> str:
    return hmac.new(secret.encode(), canonical_text(timestamp, method, path, body), hashlib.sha256).hexdigest()


def signed_headers(key_id: str, secret: str, method: str, path: str, body: bytes = b'', now: float | None = None) -> dict:
    """Headers for a request signed now (or at `now`, in Unix seconds)."""
    timestamp = str(int(time.time() if now is None else now))
    return {
        KEY_HEADER: key_id,
        TIMESTAMP_HEADER: timestamp,
        SIGNATURE_HEADER: sign(secret, timestamp, method, path, body),
    }

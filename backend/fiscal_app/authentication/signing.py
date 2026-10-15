"""HMAC request signing shared by Fiscal. and its client systems, in both directions (requests and webhooks).

Headers:
    X-Fiscal-Key        public key id of the client system
    X-Fiscal-Timestamp  Unix seconds when the request was signed
    X-Fiscal-Signature  hex(HMAC-SHA256(secret, canonical text))
    X-Fiscal-Origin     host the request is made for (restaurante-x.waiter.co); required when the client system
                        has a domain registered, and signed with the rest

Canonical text: timestamp, upper-case method, path with its query string and the SHA-256 hex of the exact body,
joined by newlines; when X-Fiscal-Origin is sent, its exact value is a fifth line. Client systems (Waiter) implement
exactly this function.
"""

import hashlib
import hmac
import time

KEY_HEADER = 'X-Fiscal-Key'
TIMESTAMP_HEADER = 'X-Fiscal-Timestamp'
SIGNATURE_HEADER = 'X-Fiscal-Signature'
ORIGIN_HEADER = 'X-Fiscal-Origin'


def canonical_text(timestamp: str, method: str, path: str, body: bytes, origin: str = '') -> bytes:
    lines = [timestamp, method.upper(), path, hashlib.sha256(body).hexdigest()]
    if origin:
        lines.append(origin)
    return '\n'.join(lines).encode()


def sign(secret: str, timestamp: str, method: str, path: str, body: bytes, origin: str = '') -> str:
    return hmac.new(secret.encode(), canonical_text(timestamp, method, path, body, origin), hashlib.sha256).hexdigest()


def signed_headers(
    key_id: str, secret: str, method: str, path: str, body: bytes = b'', now: float | None = None, origin: str = '',
) -> dict:
    """Headers for a request signed now (or at `now`, in Unix seconds), for `origin` when given."""
    timestamp = str(int(time.time() if now is None else now))
    headers = {
        KEY_HEADER: key_id,
        TIMESTAMP_HEADER: timestamp,
        SIGNATURE_HEADER: sign(secret, timestamp, method, path, body, origin),
    }
    if origin:
        headers[ORIGIN_HEADER] = origin
    return headers

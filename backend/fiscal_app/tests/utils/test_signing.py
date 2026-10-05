"""Tests for the canonical HMAC signature shared with client systems."""

import hashlib
import hmac

from fiscal_app.authentication.signing import canonical_text, sign, signed_headers


def test_canonical_text_is_the_documented_contract():
    """Fails if the canonical text changes shape: every client system (Waiter) reproduces it byte by byte."""
    text = canonical_text('1759600000', 'put', '/api/v1/issuers/900373115/update/?x=1', b'{"a":1}')

    assert text == (
        b'1759600000\nPUT\n/api/v1/issuers/900373115/update/?x=1\n' + hashlib.sha256(b'{"a":1}').hexdigest().encode()
    )


def test_signature_is_hmac_sha256_of_the_canonical_text():
    """Fails if the signature stops being HMAC-SHA256 hex of the canonical text with the client secret."""
    expected = hmac.new(b'secreto', canonical_text('1', 'GET', '/p/', b''), hashlib.sha256).hexdigest()

    assert sign('secreto', '1', 'GET', '/p/', b'') == expected


def test_signed_headers_are_the_three_documented_ones():
    """Fails if the three documented headers are not produced together."""
    headers = signed_headers('fk_1', 'secreto', 'GET', '/p/', now=1759600000)

    assert headers == {
        'X-Fiscal-Key': 'fk_1',
        'X-Fiscal-Timestamp': '1759600000',
        'X-Fiscal-Signature': sign('secreto', '1759600000', 'GET', '/p/', b''),
    }

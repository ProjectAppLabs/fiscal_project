"""Tests for the origin rules of client systems: host names, domains, networks and the caller's IP."""

import pytest
from django.test import RequestFactory

from fiscal_app.services.origins import check_webhook_domain, client_ip, host_in_domain, normalize_host, parse_networks


@pytest.mark.parametrize(
    ('value', 'expected'),
    [
        ('Waiter.CO', 'waiter.co'),
        ('restaurante-x.waiter.co.', 'restaurante-x.waiter.co'),
        ('cafetería.waiter.co', 'xn--cafetera-i2a.waiter.co'),
        ('localhost', ''),
        ('waiter.co:443', ''),
        ('-bad.waiter.co', ''),
        ('', ''),
    ],
)
def test_normalize_host(value, expected):
    """Fails if a host is not lower-cased and punycoded, or an invalid one gets through."""
    assert normalize_host(value) == expected


@pytest.mark.parametrize(
    ('host', 'allow_subdomains', 'expected'),
    [
        ('waiter.co', False, True),
        ('waiter.co', True, True),
        ('restaurante-x.waiter.co', True, True),
        ('restaurante-x.waiter.co', False, False),
        ('evilwaiter.co', True, False),
        ('waiter.co.evil.com', True, False),
    ],
)
def test_host_in_domain(host, allow_subdomains, expected):
    """Fails if a look-alike host passes, or a subdomain passes without allow_subdomains."""
    assert host_in_domain(host, 'waiter.co', allow_subdomains) is expected


def test_invalid_network_is_named():
    """Fails if a bad IP in the list is accepted or not named in the error."""
    with pytest.raises(ValueError, match='999.1.1.1'):
        parse_networks(['10.0.0.0/8', '999.1.1.1'])


@pytest.mark.parametrize(
    ('remote', 'forwarded', 'expected'),
    [
        ('203.0.113.10', '', '203.0.113.10'),
        ('203.0.113.10', '198.51.100.7', '203.0.113.10'),
        ('127.0.0.1', '198.51.100.7', '198.51.100.7'),
        ('127.0.0.1', '1.1.1.1, 198.51.100.7', '198.51.100.7'),
    ],
)
def test_client_ip(remote, forwarded, expected, settings):
    """Fails if X-Forwarded-For is trusted from anyone but the proxy, or a spoofed left entry wins."""
    settings.FISCAL_TRUSTED_PROXIES = ['127.0.0.1']
    request = RequestFactory().get('/', REMOTE_ADDR=remote, HTTP_X_FORWARDED_FOR=forwarded)

    assert client_ip(request) == expected


def test_webhook_outside_the_domain_is_refused():
    """Fails if the notice URL can point outside the registered domain."""
    with pytest.raises(ValueError, match='waiter.co'):
        check_webhook_domain('https://avisos.otro.co/fiscal/', 'waiter.co', allow_subdomains=True)


def test_webhook_in_a_subdomain_is_accepted():
    """Fails if a notice URL on an allowed subdomain is refused."""
    assert check_webhook_domain('https://api.waiter.co/fiscal/', 'waiter.co', allow_subdomains=True) is None

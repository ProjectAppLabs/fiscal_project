"""Where a client system's requests may come from: its domain (and subdomains), its IPs, and each issuer's own host.

A server-to-server call carries no verifiable domain, so the client system declares its host in X-Fiscal-Origin and
signs it with the request (see authentication/signing.py). Fiscal. checks that host against the registered domain,
binds each issuer to the host it was created from, and, when IPs are listed, checks the caller's address too.
"""

import ipaddress
import logging
import re
from urllib.parse import urlsplit

from django.conf import settings
from rest_framework import status

from fiscal_app.utils.errors import FiscalError

logger = logging.getLogger(__name__)

# One DNS label: letters, digits and inner hyphens, up to 63 characters.
_LABEL = re.compile(r'^(?!-)[a-z0-9-]{1,63}(?<!-)$')


def normalize_host(value: str) -> str:
    """A lower-case host name without trailing dot (IDN in punycode), or '' when it is not a valid host name."""
    host = (value or '').strip().lower().rstrip('.')
    try:
        host = host.encode('idna').decode('ascii')
    except UnicodeError:
        return ''
    labels = host.split('.')
    if len(host) > 253 or len(labels) < 2 or not all(_LABEL.match(label) for label in labels):
        return ''
    return host


def host_in_domain(host: str, domain: str, allow_subdomains: bool) -> bool:
    """The domain itself, or with allow_subdomains any host ending in «.domain» (evil-waiter.co never matches)."""
    if not host or not domain:
        return False
    return host == domain or (allow_subdomains and host.endswith(f'.{domain}'))


def parse_networks(values) -> list:
    """IPs and CIDR networks; raises ValueError naming the first invalid one."""
    networks = []
    for value in values or []:
        try:
            networks.append(ipaddress.ip_network(str(value).strip(), strict=False))
        except ValueError as error:
            raise ValueError(f'«{value}» no es una IP ni una red válida.') from error
    return networks


def client_ip(request) -> str:
    """The caller's address. Behind a trusted proxy, the right-most X-Forwarded-For entry that is not a proxy."""
    remote = request.META.get('REMOTE_ADDR', '')
    trusted = parse_networks(settings.FISCAL_TRUSTED_PROXIES)
    if not _in_networks(remote, trusted):
        return remote
    forwarded = [item.strip() for item in request.META.get('HTTP_X_FORWARDED_FOR', '').split(',') if item.strip()]
    for address in reversed(forwarded):
        if not _in_networks(address, trusted):
            return address
    return remote


def check_request_origin(client, origin_header: str, ip: str) -> str | None:
    """The verified host of a signed request, or None when the client system has no domain. Raises 403 otherwise."""
    if client.allowed_ips and not _in_networks(ip, parse_networks(client.allowed_ips)):
        logger.warning('Petición del sistema cliente %s desde una IP no permitida (%s)', client.pk, ip)
        raise FiscalError('Esta IP no está autorizada para el sistema cliente.', 'ip_not_allowed', status.HTTP_403_FORBIDDEN)
    if not client.domain:
        return normalize_host(origin_header) or None
    host = normalize_host(origin_header)
    if not host:
        raise FiscalError(
            'Falta el encabezado X-Fiscal-Origin con el dominio desde el que se hace la petición.',
            'origin_required', status.HTTP_403_FORBIDDEN,
        )
    if not host_in_domain(host, client.domain, client.allow_subdomains):
        logger.warning('Petición del sistema cliente %s desde un origen no permitido (%s)', client.pk, host)
        raise FiscalError('El origen de la petición no pertenece al dominio del sistema cliente.', 'origin_not_allowed', status.HTTP_403_FORBIDDEN)
    return host


def check_issuer_origin(issuer, origin: str | None) -> None:
    """An issuer bound to a host only answers requests declaring that host (when its client system has a domain)."""
    if not issuer.client.domain or not issuer.origin_host or origin == issuer.origin_host:
        return
    logger.warning('El origen %s pidió el emisor %s, atado a %s', origin, issuer.pk, issuer.origin_host)
    raise FiscalError('Este emisor pertenece a otro origen del sistema cliente.', 'origin_mismatch', status.HTTP_403_FORBIDDEN)


def check_webhook_domain(url: str, domain: str, allow_subdomains: bool) -> None:
    """With a domain registered, the notice URL must live in it. Raises ValueError with the reason."""
    if not url or not domain:
        return
    host = normalize_host(urlsplit(url).hostname or '')
    if not host_in_domain(host, domain, allow_subdomains):
        rule = f'{domain} o uno de sus subdominios' if allow_subdomains else domain
        raise ValueError(f'La URL de avisos debe estar en {rule}.')


def _in_networks(address: str, networks: list) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    return any(ip in network for network in networks)

"""Turn a certificate and its private key delivered as separate files into the .p12 Fiscal. stores.

Several certification entities deliver the certificate (.cer/.crt/.pem, sometimes inside a .zip) and the key the
applicant generated with the request (.key) instead of a .p12. This module checks that the key belongs to the
certificate, completes the chain up to the root with the issuer addresses the certificate itself carries (Authority
Information Access, «caIssuers»), and packs everything into a .p12 protected with a random password.

Downloading the chain is guarded: only http/https, no redirects, a size limit, and never a private, loopback or
link-local address, so a crafted certificate cannot make Fiscal. reach internal services.
"""

import base64
import io
import ipaddress
import logging
import secrets
import socket
import zipfile
from dataclasses import dataclass
from urllib.parse import urlsplit

import requests
from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import BestAvailableEncryption, pkcs12
from cryptography.x509.oid import AuthorityInformationAccessOID
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)
MAX_CHAIN = 4
MAX_DOWNLOAD = 64 * 1024
DOWNLOAD_TIMEOUT = 10
CERTIFICATE_SUFFIXES = ('.cer', '.crt', '.pem', '.der')


@dataclass(frozen=True)
class AssembledP12:
    p12_base64: str
    password: str
    chain_complete: bool  # False when an intermediate or the root could not be downloaded


def assemble(certificate_file: bytes, key_file: bytes, key_password: str = '', fetch=None) -> AssembledP12:
    """The .p12 of a certificate and its private key, with the chain up to the root when it can be downloaded."""
    certificate = _certificate(certificate_file)
    key = _private_key(key_file, key_password)
    if key.public_key().public_numbers() != certificate.public_key().public_numbers():
        raise ValidationError('La llave privada no corresponde al certificado.', code='key_mismatch')
    chain, complete = _chain(certificate, fetch or download)
    password = secrets.token_urlsafe(18)
    raw = pkcs12.serialize_key_and_certificates(b'Fiscal.', key, certificate, chain or None,
                                                BestAvailableEncryption(password.encode()))
    return AssembledP12(base64.b64encode(raw).decode(), password, complete)


def _certificate(data: bytes) -> x509.Certificate:
    if zipfile.is_zipfile(io.BytesIO(data)):
        data = _single_certificate_in_zip(data)
    for load in (x509.load_pem_x509_certificate, x509.load_der_x509_certificate):
        try:
            return load(data)
        except ValueError:
            continue
    raise ValidationError('El archivo no es un certificado (.cer, .crt o .pem).', code='invalid_certificate')


def _single_certificate_in_zip(data: bytes) -> bytes:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith(CERTIFICATE_SUFFIXES)]
        if len(names) != 1:
            raise ValidationError('El .zip debe traer un solo certificado (.cer, .crt o .pem).', code='invalid_certificate')
        if archive.getinfo(names[0]).file_size > MAX_DOWNLOAD:
            raise ValidationError('El certificado del .zip es demasiado grande.', code='invalid_certificate')
        return archive.read(names[0])


def _private_key(data: bytes, password: str):
    secret = password.encode() if password else None
    for load in (serialization.load_pem_private_key, serialization.load_der_private_key):
        try:
            return load(data, password=secret)
        except TypeError as error:
            # Encrypted key without password, or a password for a key that has none.
            raise ValidationError('La llave privada necesita su contraseña (o no lleva ninguna).', code='key_password') from error
        except ValueError:
            continue
    raise ValidationError('No se pudo leer la llave privada: revisa el archivo y su contraseña.', code='invalid_key')


def _chain(certificate, fetch):
    """Issuers of the certificate up to a self-signed root, following AIA caIssuers. (chain, complete)."""
    chain, current = [], certificate
    for _ in range(MAX_CHAIN):
        if current.issuer == current.subject:
            return chain, True
        url = _ca_issuers_url(current)
        if url is None:
            return chain, False
        try:
            parent = _certificate(fetch(url))
        except (ValidationError, requests.RequestException, OSError) as error:
            logger.warning('No se pudo descargar la cadena desde %s: %s', url, type(error).__name__)
            return chain, False
        if parent.subject != current.issuer:
            logger.warning('El certificado descargado de %s no es el emisor esperado.', url)
            return chain, False
        chain.append(parent)
        current = parent
    return chain, current.issuer == current.subject


def _ca_issuers_url(certificate):
    try:
        access = certificate.extensions.get_extension_for_class(x509.AuthorityInformationAccess).value
    except x509.ExtensionNotFound:
        return None
    return next((item.access_location.value for item in access
                 if item.access_method == AuthorityInformationAccessOID.CA_ISSUERS), None)


def download(url: str) -> bytes:
    """GET a public issuer certificate: http(s) only, public addresses only, no redirects, at most MAX_DOWNLOAD."""
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https') or not parts.hostname:
        raise ValidationError('Dirección de la cadena no permitida.', code='chain_url')
    for info in socket.getaddrinfo(parts.hostname, parts.port or (443 if parts.scheme == 'https' else 80)):
        address = ipaddress.ip_address(info[4][0])
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            raise ValidationError('Dirección de la cadena no permitida.', code='chain_url')
    response = requests.get(url, timeout=DOWNLOAD_TIMEOUT, allow_redirects=False, stream=True)
    response.raise_for_status()
    content = response.raw.read(MAX_DOWNLOAD + 1, decode_content=True)
    if len(content) > MAX_DOWNLOAD:
        raise ValidationError('El certificado de la cadena es demasiado grande.', code='chain_url')
    return content

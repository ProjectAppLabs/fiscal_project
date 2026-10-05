"""Authentication of client systems (machines) with HMAC-signed requests. Operators use the template's JWT."""

import hmac
import time

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

from fiscal_app.models import ClientSystem
from fiscal_app.services.client_systems import valid_secrets

from .signing import KEY_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER, sign

# A secret nobody has: compared when the key id is unknown, so timing does not reveal which key ids exist.
_DECOY_SECRET = 'fiscal-unknown-client'


class ClientSystemAuthentication(BaseAuthentication):
    def authenticate(self, request):
        key_id = request.headers.get(KEY_HEADER, '')
        timestamp = request.headers.get(TIMESTAMP_HEADER, '')
        signature = request.headers.get(SIGNATURE_HEADER, '')
        if not (key_id and timestamp and signature):
            raise AuthenticationFailed('Falta la firma de la petición.', code='signature_missing')
        if not timestamp.isdigit() or abs(time.time() - int(timestamp)) > settings.FISCAL_SIGNATURE_MAX_AGE:
            raise AuthenticationFailed('La firma está vencida o la hora es inválida.', code='signature_expired')
        client = ClientSystem.objects.filter(key_id=key_id, active=True).first()
        secrets = valid_secrets(client) if client else [_DECOY_SECRET]
        body = request._request.body
        path = request._request.get_full_path()
        matches = [
            hmac.compare_digest(sign(secret, timestamp, request.method, path, body), signature) for secret in secrets
        ]
        if client is None or not any(matches):
            raise AuthenticationFailed('La firma de la petición no es válida.', code='signature_invalid')
        return client, None

    def authenticate_header(self, request):
        return 'Fiscal-HMAC'


class IsClientSystem(BasePermission):
    """Only an authenticated client system: an operator's JWT does not open the machine API."""

    def has_permission(self, request, view):
        return isinstance(request.user, ClientSystem)

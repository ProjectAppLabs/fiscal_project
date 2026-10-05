"""Stable error shape for the machine API (/api/v1/): {"error": {"code", "message", "fields"?}}.

Messages are in Spanish and ready to show to the business. Routes outside /api/v1/ keep the template's DRF shape.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

MACHINE_API_PREFIX = '/api/v1/'


class FiscalError(exceptions.APIException):
    """An expected business error with a stable code (e.g. issuer_not_found)."""

    def __init__(self, message, code, status_code=status.HTTP_400_BAD_REQUEST):
        self.status_code = status_code
        super().__init__(message, code)


def _first_code(detail):
    if isinstance(detail, dict):
        return _first_code(next(iter(detail.values()), None))
    if isinstance(detail, list):
        return _first_code(detail[0] if detail else None)
    return getattr(detail, 'code', None) or 'invalid'


def fiscal_exception_handler(exc, context):
    request = context.get('request')
    on_machine_api = request is not None and request.path.startswith(MACHINE_API_PREFIX)
    if isinstance(exc, DjangoValidationError) and on_machine_api:
        message = exc.messages[0] if exc.messages else 'Datos inválidos.'
        return Response({'error': {'code': exc.code or 'invalid', 'message': message}}, status=400)
    response = exception_handler(exc, context)
    if response is None or not on_machine_api:
        return response
    detail = getattr(exc, 'detail', None)
    if isinstance(detail, (dict, list)):
        body = {'code': 'invalid_data', 'message': 'Revisa los datos enviados.', 'fields': response.data}
        # A single field error with its own code (e.g. invalid_dv) is more useful than the generic one.
        code = _first_code(detail)
        if code not in ('invalid', 'required', 'null', 'blank'):
            body['code'] = code
    else:
        body = {'code': getattr(detail, 'code', None) or 'error', 'message': str(detail)}
    response.data = {'error': body}
    return response

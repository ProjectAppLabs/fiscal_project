"""Operator console (JWT): the machine API's specification for the API docs pages of the console.

The docs read the same openapi.json that test_api_documentation keeps in step with the routes, so the reference in
the console never drifts from the API. Only signed-in operators get it: Fiscal. is not public.
"""

import json
import logging
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .console import IsConsoleOperator

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsConsoleOperator])
def console_api_docs(request):
    """{api_base_url, spec}: the public address of the API (empty: the console's own) and the OpenAPI document."""
    try:
        spec = _load_spec(str(settings.FISCAL_OPENAPI_PATH))
    except (OSError, ValueError):
        logger.exception('No se pudo leer la especificación de la API en %s', settings.FISCAL_OPENAPI_PATH)
        return Response({'detail': 'La especificación de la API no está disponible.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response({'api_base_url': settings.FISCAL_API_BASE_URL.rstrip('/'), 'spec': spec})


@lru_cache(maxsize=1)
def _load_spec(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding='utf-8'))

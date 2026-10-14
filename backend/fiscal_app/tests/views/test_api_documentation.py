"""The machine API (/api/v1/) is documented route by route for the client systems (Waiter first)."""

import json
import re

import pytest
from django.conf import settings
from django.urls import URLPattern, URLResolver

from fiscal_app.urls import machine

DOCS = settings.BASE_DIR.parent / 'docs' / 'fiscal'


def routes(patterns=machine.urlpatterns, prefix='/api/v1/'):
    """(METHOD, path) of every machine route, with its parameters as {} (their names differ between docs)."""
    found = set()
    for pattern in patterns:
        route = prefix + str(pattern.pattern)
        if isinstance(pattern, URLResolver):
            found |= routes(pattern.url_patterns, route)
        elif isinstance(pattern, URLPattern):
            methods = [m.upper() for m in pattern.callback.cls.http_method_names if m != 'options']
            found |= {(method, re.sub(r'<(?:\w+:)?\w+>', '{}', route)) for method in methods}
    return found


def documented_in_openapi():
    spec = json.loads((DOCS / 'openapi.json').read_text(encoding='utf-8'))
    return {(method.upper(), re.sub(r'\{\w+\}', '{}', path)) for path, item in spec['paths'].items() for method in item}


def documented_in_contract():
    headings = re.findall(r'^### `(GET|POST|PUT|PATCH|DELETE) (/api/v1/\S+)`', (DOCS / 'contrato.md').read_text(encoding='utf-8'),
                          re.MULTILINE)
    return {(method, re.sub(r'\{\w+\}', '{}', path)) for method, path in headings}


@pytest.mark.parametrize('documented', [documented_in_openapi, documented_in_contract], ids=['openapi', 'contract'])
def test_every_machine_route_is_documented(documented):
    """Fails if a /api/v1/ route is missing from openapi.json or contrato.md, or one of them lists a route that is gone."""
    assert documented() == routes()

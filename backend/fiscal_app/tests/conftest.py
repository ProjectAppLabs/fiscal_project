from datetime import date

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def existing_user(db):
    """Regular authenticated user for use in tests requiring a logged-in operator."""
    User = get_user_model()
    return User.objects.create_user(
        email='user@example.com',
        password='existingpassword',
        first_name='Test',
        last_name='User',
    )


@pytest.fixture
def admin_user(db):
    """Staff/admin user for use in tests requiring elevated permissions."""
    User = get_user_model()
    user = User.objects.create_user(
        email='admin@example.com',
        password='adminpassword',
        first_name='Admin',
        last_name='User',
    )
    user.is_staff = True
    user.is_superuser = True
    user.save(update_fields=['is_staff', 'is_superuser'])
    return user


@pytest.fixture
def authenticated_client(api_client, existing_user):
    """APIClient pre-authenticated as a regular user."""
    api_client.force_authenticate(user=existing_user)
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    """APIClient pre-authenticated as a staff/admin user."""
    api_client.force_authenticate(user=admin_user)
    return api_client


def pytest_collection_modifyitems(config, items):
    """Skip MySQL-only tests when the suite runs on SQLite (the template default)."""
    if 'mysql' in settings.DATABASES['default']['ENGINE']:
        return
    skip = pytest.mark.skip(reason='needs MySQL: set DJANGO_TEST_DB_ENGINE=django.db.backends.mysql')
    for item in items:
        if 'mysql' in item.keywords:
            item.add_marker(skip)


@pytest.fixture
def client_system(db):
    """A client system with its first secret, returned as (client, secret)."""
    from fiscal_app.services.client_systems import create_client_system

    return create_client_system('Waiter')


@pytest.fixture
def issuer(client_system):
    """A testing issuer of the client system, with a valid NIT and check digit."""
    from fiscal_app.models import Issuer
    from fiscal_app.services.nit import check_digit

    client, _secret = client_system
    return Issuer.objects.create(
        client=client, nit='900373115', dv=check_digit('900373115'), person_type='1',
        legal_name='Restaurante de Prueba SAS', address_line='Calle 10 # 43-12', municipality_code='05001',
        department_code='05', email='facturacion@restaurante.test',
    )


@pytest.fixture
def invoice_range(issuer):
    """The DIAN testing range (SETP 990000000-995000000) for the issuer."""
    from fiscal_app.models import NumberingRange

    return NumberingRange.objects.create(
        issuer=issuer, resolution_number='18760000001', prefix='SETP', number_from=990_000_000,
        number_to=995_000_000, valid_from=date(2019, 1, 19), valid_to=date(2030, 1, 19),
        technical_key='fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
    )


@pytest.fixture
def make_document(client_system, issuer, invoice_range):
    """Build documents of the issuer; keyword arguments override the defaults."""
    from django.utils import timezone

    from fiscal_app.models import Document

    client, _secret = client_system

    def build(**overrides):
        values = {
            'client': client, 'issuer': issuer, 'numbering_range': invoice_range, 'idempotency_key': 'waiter:1',
            'kind': 'invoice', 'prefix': 'SETP', 'number': 990_000_001, 'issue_datetime': timezone.now(),
            'payload': {'total': '1000.00'}, 'payload_hash': '0' * 64,
        }
        values.update(overrides)
        return Document.objects.create(**values)

    return build


class SignedClient:
    """Test client that signs every request exactly as a client system (Waiter) will."""

    def __init__(self, key_id, secret):
        import json

        self._json = json
        self.key_id, self.secret, self.http = key_id, secret, APIClient()

    def request(self, method, path, data=None, *, sign=True, headers=None):
        from fiscal_app.authentication.signing import signed_headers

        body = self._json.dumps(data).encode() if data is not None else b''
        all_headers = signed_headers(self.key_id, self.secret, method, path, body) if sign else {}
        all_headers.update(headers or {})
        call = getattr(self.http, method.lower())
        return call(path, data=body, content_type='application/json', headers=all_headers)

    def get(self, path, **kwargs):
        return self.request('GET', path, **kwargs)

    def put(self, path, data, **kwargs):
        return self.request('PUT', path, data, **kwargs)

    def post(self, path, data, **kwargs):
        return self.request('POST', path, data, **kwargs)


@pytest.fixture
def signed_client(client_system):
    """Signed test client of the `client_system` fixture."""
    client, secret = client_system
    return SignedClient(client.key_id, secret)


@pytest.fixture
def other_signed_client(db):
    """Signed test client of a second, unrelated client system."""
    from fiscal_app.services.client_systems import create_client_system

    client, secret = create_client_system('Otra casa de software')
    return SignedClient(client.key_id, secret)


def restaurant_bill():
    """A valid restaurant bill (contract v1): two lines with INC 8 %, points redemption and a 10 % tip.

    2 × 18.450 + 1 × 6.000 = 42.900; INC 8 % = 3.432; −5.000 points; +4.290 tip; payable 45.622.
    """
    return {
        'buyer': {'final_consumer': True},
        'lines': [
            {
                'code': 'HAM-01', 'description': 'Hamburguesa de la casa', 'quantity': '2', 'unit_code': '94',
                'unit_price': '18450.00', 'line_extension': '36900.00',
                'taxes': [{'code': '04', 'rate': '8.00', 'taxable_amount': '36900.00', 'amount': '2952.00'}],
            },
            {
                'code': 'LIM-01', 'description': 'Limonada natural', 'quantity': '1', 'unit_code': '94',
                'unit_price': '6000.00', 'line_extension': '6000.00',
                'taxes': [{'code': '04', 'rate': '8.00', 'taxable_amount': '6000.00', 'amount': '480.00'}],
            },
        ],
        'allowances': [{'reason': 'Canje de puntos', 'amount': '5000.00'}],
        'charges': [{'kind': 'tip', 'reason': 'Propina voluntaria', 'amount': '4290.00'}],
        'totals': {
            'line_extension': '42900.00', 'tax_exclusive': '42900.00', 'tax_inclusive': '46332.00',
            'allowance_total': '5000.00', 'charge_total': '4290.00', 'payable': '45622.00',
        },
        'payment': {'form': '1', 'means': ['10']},
    }


@pytest.fixture
def ready_issuer(issuer, invoice_range):
    """An issuer that can issue: active certificate and software registration in its environment."""
    from fiscal_app.models import SoftwareRegistration
    from fiscal_app.services.certificates import set_certificate
    from fiscal_app.services.self_signed import self_signed_p12

    set_certificate(issuer, self_signed_p12('Restaurante de Prueba SAS', 'clave'), 'clave')
    SoftwareRegistration.objects.create(issuer=issuer, environment=issuer.environment, software_id='sw-1', software_pin='1')
    return issuer


@pytest.fixture
def document_envelope(ready_issuer):
    """Build the envelope of a document of the ready issuer; keyword arguments override it."""
    from django.utils import timezone

    def build(**overrides):
        envelope = {
            'idempotency_key': 'waiter:org-1:doc-1', 'issuer': ready_issuer.nit, 'kind': 'invoice',
            'prefix': 'SETP', 'number': 990_000_001, 'issue_datetime': timezone.now().isoformat(),
            'document': restaurant_bill(),
        }
        envelope.update(overrides)
        return envelope

    return build

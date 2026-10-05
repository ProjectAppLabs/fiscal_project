"""Tests for the HMAC authentication of client systems on the machine API."""

from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from fiscal_app.authentication.signing import signed_headers
from fiscal_app.services.client_systems import rotate_secret


@pytest.mark.django_db
def test_signed_request_is_accepted(signed_client, issuer):
    """Fails if a correctly signed request from the issuer's client system is refused."""
    response = signed_client.get(f'/api/v1/issuers/{issuer.nit}/')

    assert response.status_code == 200


@pytest.mark.django_db
def test_unsigned_request_is_refused(signed_client, issuer):
    """Fails if the machine API answers a request without signature."""
    response = signed_client.get(f'/api/v1/issuers/{issuer.nit}/', sign=False)

    assert response.status_code == 401
    assert response.json()['error']['code'] == 'signature_missing'


@pytest.mark.django_db
@freeze_time('2026-10-04 15:00:00')
def test_old_signature_is_refused(signed_client, issuer):
    """Fails if a captured request can be replayed more than five minutes later."""
    path = f'/api/v1/issuers/{issuer.nit}/'
    signed_at = timezone.now().timestamp() - 301
    old = signed_headers(signed_client.key_id, signed_client.secret, 'GET', path, now=signed_at)

    response = signed_client.get(path, sign=False, headers=old)

    assert response.json()['error']['code'] == 'signature_expired'


@pytest.mark.django_db
def test_changed_body_breaks_the_signature(signed_client, issuer):
    """Fails if the body of a signed request can be altered without invalidating it."""
    path = f'/api/v1/issuers/{issuer.nit}/update/'
    headers = signed_headers(signed_client.key_id, signed_client.secret, 'PUT', path, b'{"legal_name": "A"}')

    response = signed_client.put(path, {'legal_name': 'B'}, sign=False, headers=headers)

    assert response.json()['error']['code'] == 'signature_invalid'


@pytest.mark.django_db
def test_wrong_secret_is_refused(signed_client, issuer):
    """Fails if knowing the public key id is enough without the secret."""
    path = f'/api/v1/issuers/{issuer.nit}/'

    response = signed_client.get(path, sign=False, headers=signed_headers(signed_client.key_id, 'otro', 'GET', path))

    assert response.json()['error']['code'] == 'signature_invalid'


@pytest.mark.django_db
def test_unknown_key_id_looks_like_a_bad_signature(signed_client, issuer):
    """Fails if the API reveals which key ids exist by answering an unknown one differently."""
    path = f'/api/v1/issuers/{issuer.nit}/'

    response = signed_client.get(path, sign=False, headers=signed_headers('fk_nadie', 'x', 'GET', path))

    assert response.json()['error']['code'] == 'signature_invalid'


@pytest.mark.django_db
def test_inactive_client_system_is_refused(client_system, signed_client, issuer):
    """Fails if a deactivated client system can still use the API."""
    client, _secret = client_system
    client.active = False
    client.save()

    response = signed_client.get(f'/api/v1/issuers/{issuer.nit}/')

    assert response.status_code == 401


@pytest.mark.django_db
def test_rotated_secret_works_during_grace(client_system, signed_client, issuer):
    """Fails if rotating a secret cuts off the client before it switches to the new one."""
    client, _secret = client_system
    rotate_secret(client, timedelta(hours=24))

    response = signed_client.get(f'/api/v1/issuers/{issuer.nit}/')

    assert response.status_code == 200


@pytest.mark.django_db
def test_rotated_secret_stops_after_grace(client_system, signed_client, issuer):
    """Fails if a rotated-out secret keeps opening the API after its grace period."""
    client, _secret = client_system
    rotate_secret(client, timedelta(hours=24))

    with freeze_time(timezone.now() + timedelta(hours=25)):
        response = signed_client.get(f'/api/v1/issuers/{issuer.nit}/')

    assert response.status_code == 401


@pytest.mark.django_db
def test_operator_jwt_does_not_open_the_machine_api(api_client, existing_user, issuer):
    """Fails if a console operator's JWT can call the machine API meant for client systems."""
    from fiscal_app.utils.auth_utils import generate_auth_tokens

    token = generate_auth_tokens(existing_user)['access']

    response = api_client.get(f'/api/v1/issuers/{issuer.nit}/', headers={'Authorization': f'Bearer {token}'})

    assert response.json()['error']['code'] == 'signature_missing'

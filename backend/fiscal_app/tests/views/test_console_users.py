"""Tests for the people who use the console: invitations, roles and switching someone off (administrators only)."""

from unittest import mock

import pytest

from fiscal_app.models import PasswordCode, User


@pytest.fixture
def operator(db):
    return User.objects.create_user(email='op@projectapp.co', password='clave-op-123', first_name='Luis', role=User.Role.OPERATOR)


@pytest.mark.django_db
def test_operator_cannot_list_users(authenticated_client):
    """Fails if someone who is not an administrator can see who has access to the console."""
    response = authenticated_client.get('/api/console/users/')

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_lists_the_console_users(console_admin_client, operator):
    """Fails if an administrator cannot see the operators with their role."""
    response = console_admin_client.get('/api/console/users/')

    assert {(row['email'], row['role']) for row in response.json()['results']} >= {('op@projectapp.co', 'operator')}


@pytest.mark.django_db
def test_invited_user_has_no_password_until_accepting(console_admin_client):
    """Fails if an invitation creates an account someone could enter without choosing their own password."""
    with mock.patch('fiscal_app.views.console_users.send_invitation', return_value=True):
        response = console_admin_client.post('/api/console/users/', {'email': 'Nueva@ProjectApp.co', 'first_name': 'Sara'}, format='json')

    user = User.objects.get(email='nueva@projectapp.co')
    assert (response.status_code, response.json()['invited'], user.has_usable_password()) == (201, True, False)


@pytest.mark.django_db
def test_invitation_carries_a_code_valid_for_three_days(console_admin_client):
    """Fails if the invitation code expires as fast as a password reset (15 minutes)."""
    with mock.patch('fiscal_app.views.console_users.send_invitation', return_value=True) as send:
        console_admin_client.post('/api/console/users/', {'email': 'sara@projectapp.co', 'first_name': 'Sara'}, format='json')

    code = PasswordCode.objects.get(user__email='sara@projectapp.co')
    assert code.purpose == PasswordCode.Purpose.INVITE
    assert send.call_args.args[1] == code.code


@pytest.mark.django_db
def test_invitee_sets_the_password_with_the_code(api_client, console_admin_client):
    """Fails if the invitation code does not let the new operator set a password and sign in."""
    with mock.patch('fiscal_app.views.console_users.send_invitation', return_value=True):
        console_admin_client.post('/api/console/users/', {'email': 'sara@projectapp.co', 'first_name': 'Sara'}, format='json')
    code = PasswordCode.objects.get(user__email='sara@projectapp.co').code

    api_client.post('/api/verify_passcode_and_reset_password/', {'email': 'sara@projectapp.co', 'code': code, 'new_password': 'clave-sara-1'}, format='json')

    assert User.objects.get(email='sara@projectapp.co').check_password('clave-sara-1') is True


@pytest.mark.django_db
def test_same_email_cannot_be_invited_twice(console_admin_client, operator):
    """Fails if a second account can be created for an e-mail already in the console."""
    response = console_admin_client.post('/api/console/users/', {'email': 'op@projectapp.co', 'first_name': 'Luis'}, format='json')

    assert response.status_code == 400


@pytest.mark.django_db
def test_admin_makes_an_operator_admin(console_admin_client, operator):
    """Fails if an administrator cannot change someone's role."""
    console_admin_client.patch(f'/api/console/users/{operator.pk}/', {'role': 'admin'}, format='json')

    operator.refresh_from_db()
    assert operator.role == User.Role.ADMIN


@pytest.mark.django_db
def test_admin_switches_an_operator_off(console_admin_client, operator):
    """Fails if an administrator cannot take console access away from someone."""
    console_admin_client.patch(f'/api/console/users/{operator.pk}/', {'is_active': False}, format='json')

    operator.refresh_from_db()
    assert operator.is_active is False


@pytest.mark.django_db
def test_admin_cannot_switch_themself_off(console_admin_client, console_admin):
    """Fails if an administrator can lock themself out of the console."""
    response = console_admin_client.patch(f'/api/console/users/{console_admin.pk}/', {'is_active': False}, format='json')

    console_admin.refresh_from_db()
    assert (response.status_code, console_admin.is_active) == (409, True)


@pytest.mark.django_db
def test_last_admin_keeps_the_role(console_admin_client, console_admin):
    """Fails if the console can be left without any active administrator."""
    User.objects.create_user(email='otra@projectapp.co', password='clave-otra-1', role=User.Role.ADMIN, is_active=False)
    other_admin = User.objects.create_user(email='tercera@projectapp.co', password='clave-ter-1', role=User.Role.ADMIN)
    other_admin.is_active = False
    other_admin.save(update_fields=['is_active'])

    response = console_admin_client.patch(f'/api/console/users/{console_admin.pk}/', {'role': 'operator'}, format='json')

    console_admin.refresh_from_db()
    assert (response.status_code, console_admin.role) == (409, User.Role.ADMIN)


@pytest.mark.django_db
def test_invitation_is_sent_again(console_admin_client):
    """Fails if a lost invitation cannot be sent again with a fresh code."""
    with mock.patch('fiscal_app.views.console_users.send_invitation', return_value=True):
        created = console_admin_client.post('/api/console/users/', {'email': 'sara@projectapp.co', 'first_name': 'Sara'}, format='json').json()
        first = PasswordCode.objects.get(user_id=created['id']).code
        console_admin_client.post(f'/api/console/users/{created["id"]}/resend-invitation/', {}, format='json')

    assert PasswordCode.objects.filter(user_id=created['id'], used=False).exclude(code=first).count() == 1


@pytest.mark.django_db
def test_active_account_gets_no_new_invitation(console_admin_client, operator):
    """Fails if someone who already set a password receives an invitation instead of using the reset flow."""
    response = console_admin_client.post(f'/api/console/users/{operator.pk}/resend-invitation/', {}, format='json')

    assert response.status_code == 409

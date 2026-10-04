"""Tests for the console operator user model."""

import pytest
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_user_default_role_operator():
    """Fails if a new console user gets more than the operator role by default."""
    User = get_user_model()
    user = User.objects.create_user(email='user@example.com', password='pass1234')
    assert user.role == User.Role.OPERATOR


@pytest.mark.django_db
def test_create_superuser_sets_admin_role():
    """Fails if a superuser is not staff, superuser and admin at once."""
    User = get_user_model()
    admin = User.objects.create_superuser(email='admin@example.com', password='pass1234')
    assert admin.is_staff is True
    assert admin.is_superuser is True
    assert admin.role == User.Role.ADMIN


@pytest.mark.django_db
def test_create_user_requires_email():
    """Fails if an operator can be created without the email used to sign in."""
    User = get_user_model()
    with pytest.raises(ValueError, match='The Email field must be set'):
        User.objects.create_user(email='', password='pass1234')
    assert User.objects.filter(email='').count() == 0


@pytest.mark.django_db
def test_create_superuser_requires_is_staff():
    """Fails if a superuser can be created without staff access."""
    User = get_user_model()
    with pytest.raises(ValueError, match='Superuser must have is_staff=True.'):
        User.objects.create_superuser(email='badstaff@example.com', password='pass1234', is_staff=False)
    assert User.objects.filter(email='badstaff@example.com').count() == 0


@pytest.mark.django_db
def test_create_superuser_requires_is_superuser():
    """Fails if create_superuser accepts is_superuser=False."""
    User = get_user_model()
    with pytest.raises(ValueError, match='Superuser must have is_superuser=True.'):
        User.objects.create_superuser(email='badsuper@example.com', password='pass1234', is_superuser=False)
    assert User.objects.filter(email='badsuper@example.com').count() == 0


@pytest.mark.django_db
def test_user_str_representation():
    """Fails if an operator is not shown by email in the admin."""
    User = get_user_model()
    user = User.objects.create_user(email='str@example.com', password='pass1234')
    assert str(user) == 'str@example.com'

"""Operator console (JWT, administrators): the people who use the console.

There is no public sign-up. An administrator invites an operator by e-mail; the invitation carries a code to set
the password (valid 72 hours). Passwords are never seen nor set by someone else. Replaces the createsuperuser /
create_users server commands for day-to-day work (the very first administrator still comes with the deployment).
"""

import logging

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from fiscal_app.models import PasswordCode, User
from fiscal_app.utils.auth_utils import send_invitation

from .console import IsConsoleAdmin

logger = logging.getLogger(__name__)


class UserInviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.OPERATOR)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Ya hay un usuario con ese correo.')
        return value


class UserUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsConsoleAdmin])
def console_users(request):
    """GET: everyone with access to the console. POST: invite a new operator or administrator."""
    if request.method == 'GET':
        users = User.objects.filter(role__in=[User.Role.OPERATOR, User.Role.ADMIN]).order_by('-is_active', 'first_name', 'email')
        return Response({'count': users.count(), 'results': [_row(user) for user in users]})
    serializer = UserInviteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        user = User.objects.create_user(password=None, is_staff=False, **serializer.validated_data)
        sent = _invite(user, request.user)
    logger.info('Usuario %s invitado por el administrador %s', user.pk, request.user.pk)
    return Response({**_row(user), 'invitation_sent': sent}, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsConsoleAdmin])
def console_user(request, user_id):
    """Name, role or switching someone off. Nobody switches themselves off, and the last administrator stays one."""
    user = get_object_or_404(User, pk=user_id)
    serializer = UserUpdateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if user.pk == request.user.pk and (data.get('is_active') is False or data.get('role') == User.Role.OPERATOR):
        return Response({'detail': 'No puedes desactivarte ni quitarte el rol de administrador a ti mismo.'}, status=status.HTTP_409_CONFLICT)
    losing_admin = user.role == User.Role.ADMIN and user.is_active and (data.get('role') == User.Role.OPERATOR or data.get('is_active') is False)
    if losing_admin and User.objects.filter(role=User.Role.ADMIN, is_active=True).exclude(pk=user.pk).count() == 0:
        return Response({'detail': 'Tiene que quedar al menos un administrador activo.'}, status=status.HTTP_409_CONFLICT)
    for field, value in data.items():
        setattr(user, field, value)
    user.save(update_fields=list(data) or None)
    logger.info('Usuario %s cambiado por el administrador %s: %s', user.pk, request.user.pk, sorted(data))
    return Response(_row(user))


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsConsoleAdmin])
def console_resend_invitation(request, user_id):
    """A new invitation code for someone who has not set a password yet."""
    user = get_object_or_404(User, pk=user_id)
    if user.has_usable_password():
        return Response({'detail': 'Ya activó su cuenta: si olvidó la contraseña, que use «¿Olvidaste tu contraseña?».'},
                        status=status.HTTP_409_CONFLICT)
    return Response({**_row(user), 'invitation_sent': _invite(user, request.user)})


def _invite(user, admin):
    code = PasswordCode.generate_code(user, PasswordCode.Purpose.INVITE)
    return send_invitation(user, code.code, f'{admin.first_name} {admin.last_name}'.strip() or admin.email)


def _row(user):
    return {
        'id': user.pk, 'email': user.email, 'first_name': user.first_name, 'last_name': user.last_name,
        'role': user.role, 'is_active': user.is_active, 'invited': not user.has_usable_password(),
        'last_login': user.last_login, 'date_joined': user.date_joined,
    }

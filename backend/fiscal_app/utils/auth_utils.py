"""
Authentication utility functions.
"""
import logging
import smtplib
from urllib.parse import quote

from django.conf import settings
from django.core.mail import send_mail
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)


def generate_auth_tokens(user):
    """
    Generate JWT tokens for a user.
    
    :param user: User instance
    :return: Dictionary with refresh, access tokens and user data
    """
    refresh = RefreshToken.for_user(user)
    
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'is_staff': user.is_staff,
        }
    }


def send_password_reset_code(user, code):
    """Email the 6-digit code that resets the operator's password (valid 15 minutes). True when it was sent."""
    message = f"""Hola, {user.first_name or user.email}:

Pediste restablecer tu contraseña de la consola de Fiscal. Tu código es:

{code}

Vence en 15 minutos. Si no lo pediste, ignora este correo: tu contraseña sigue igual.

Fiscal. · ProjectApp
"""
    return _send('Tu código para restablecer la contraseña de Fiscal.', message, user.email)


def send_invitation(user, code, invited_by):
    """Email the invitation to the console: a link to set the password and its code (valid 72 hours)."""
    link = f'{settings.FRONTEND_URL}/forgot-password?invite=1&email={quote(user.email)}'
    message = f"""Hola, {user.first_name or user.email}:

{invited_by} te invitó a la consola de Fiscal., la facturación electrónica de ProjectApp.

Para activar tu cuenta, entra a {link}
y escribe este código con la contraseña que quieras:

{code}

El código vence en 72 horas. Si no esperabas esta invitación, ignora este correo.

Fiscal. · ProjectApp
"""
    return _send('Te invitaron a la consola de Fiscal.', message, user.email)


def _send(subject, message, email):
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        return True
    except (smtplib.SMTPException, OSError):
        logger.exception('No se pudo enviar el correo «%s»', subject)
        return False


def send_verification_code(email, code):
    """
    Send verification code for new user registration.
    
    :param email: User email
    :param code: 6-digit code
    """
    subject = 'Email Verification Code'
    message = f'''
Hello,

Welcome! Your email verification code is:

{code}

This code will expire in 15 minutes.

Best regards,
The Team
    '''
    
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

"""
Authentication views for console operators: sign in and password management.

There is no public sign-up: operators are created by an administrator.
"""
import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth import get_user_model


from fiscal_app.models import PasswordCode
from fiscal_app.utils.auth_utils import (
    generate_auth_tokens, 
    send_password_reset_code
)
from fiscal_app.views.captcha_views import verify_recaptcha

User = get_user_model()

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def sign_in(request):
    """
    User sign in endpoint.
    
    Expected data:
    - email: str
    - password: str
    """
    captcha_token = request.data.get('captcha_token', '')
    if not verify_recaptcha(captcha_token):
        return Response(
            {'captcha_token': ['reCAPTCHA verification failed.']},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password')
    
    if not email or not password:
        return Response(
            {'error': 'Email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not check_password(password, user.password):
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not user.is_active:
        return Response(
            {'error': 'Account is inactive'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Generate tokens
    tokens = generate_auth_tokens(user)
    
    return Response(tokens, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def send_passcode(request):
    """
    Send password reset code to user's email.
    
    Expected data:
    - email: str
    """
    email = request.data.get('email', '').strip().lower()
    
    if not email:
        return Response(
            {'error': 'Email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Don't reveal if user exists
        return Response(
            {'message': 'If the email exists, a code has been sent'},
            status=status.HTTP_200_OK
        )
    
    # Generate and save code
    password_code = PasswordCode.generate_code(user)
    
    # Send email
    success = send_password_reset_code(user, password_code.code)
    
    if not success:
        return Response(
            {'error': 'Failed to send email'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return Response(
        {'message': 'Code sent successfully'},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_passcode_and_reset_password(request):
    """
    Verify passcode and reset password.
    
    Expected data:
    - email: str
    - code: str
    - new_password: str
    """
    email = request.data.get('email', '').strip().lower()
    code = request.data.get('code', '').strip()
    new_password = request.data.get('new_password')
    
    if not email or not code or not new_password:
        return Response(
            {'error': 'Email, code, and new password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid email or code'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Find valid code
    try:
        password_code = user.password_codes.filter(
            code=code,
            used=False
        ).first()
        
        if not password_code or not password_code.is_valid():
            return Response(
                {'error': 'Invalid or expired code'},
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception:
        return Response(
            {'error': 'Invalid or expired code'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Update password
    user.password = make_password(new_password)
    user.save()
    
    # Mark code as used
    password_code.used = True
    password_code.save()
    
    return Response(
        {'message': 'Password reset successfully'},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_password(request):
    """
    Update user password (requires authentication).
    
    Expected data:
    - current_password: str
    - new_password: str
    """
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    
    if not current_password or not new_password:
        return Response(
            {'error': 'Current password and new password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = request.user
    
    if not check_password(current_password, user.password):
        return Response(
            {'error': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user.password = make_password(new_password)
    user.save()
    
    return Response(
        {'message': 'Password updated successfully'},
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def validate_token(request):
    """
    Validate JWT token and return user info.
    """
    user = request.user
    return Response({
        'valid': True,
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'is_staff': user.is_staff,
        }
    }, status=status.HTTP_200_OK)

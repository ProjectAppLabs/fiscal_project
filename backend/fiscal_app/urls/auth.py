from django.urls import path
from fiscal_app.views import auth

urlpatterns = [
    path('sign_in/', auth.sign_in, name='sign_in'),
    path('send_passcode/', auth.send_passcode, name='send_passcode'),
    path('verify_passcode_and_reset_password/', auth.verify_passcode_and_reset_password, name='verify_passcode_reset'),
    path('update_password/', auth.update_password, name='update_password'),
    path('validate_token/', auth.validate_token, name='validate_token'),
]

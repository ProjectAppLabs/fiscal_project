from django.urls import include, path

urlpatterns = [
    path('', include('fiscal_app.urls.auth')),
    path('google-captcha/', include('fiscal_app.urls.captcha')),
    path('', include('fiscal_app.urls.staging_phase_banner')),
]

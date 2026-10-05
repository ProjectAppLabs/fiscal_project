"""Machine API (/api/v1/): client systems authenticated with HMAC-signed requests."""

from django.urls import include, path

urlpatterns = [
    path('', include('fiscal_app.urls.issuers')),
]

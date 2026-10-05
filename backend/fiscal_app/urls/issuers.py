from django.urls import path

from fiscal_app.views import issuers

urlpatterns = [
    path('issuers/<str:nit>/', issuers.retrieve_issuer, name='retrieve-issuer'),
    path('issuers/<str:nit>/update/', issuers.update_issuer, name='update-issuer'),
    path('issuers/<str:nit>/certificate/update/', issuers.update_certificate, name='update-issuer-certificate'),
    path('issuers/<str:nit>/software/update/', issuers.update_software, name='update-issuer-software'),
    path('issuers/<str:nit>/ranges/', issuers.list_ranges, name='list-issuer-ranges'),
    path('issuers/<str:nit>/ranges/create/', issuers.create_range, name='create-issuer-range'),
]

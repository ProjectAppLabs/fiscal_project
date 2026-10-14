from django.urls import path

from fiscal_app.views import issuer_habilitation, issuers

urlpatterns = [
    path('issuers/<str:nit>/', issuers.retrieve_issuer, name='retrieve-issuer'),
    path('issuers/<str:nit>/update/', issuers.update_issuer, name='update-issuer'),
    path('issuers/<str:nit>/certificate/update/', issuers.update_certificate, name='update-issuer-certificate'),
    path('issuers/<str:nit>/software/update/', issuers.update_software, name='update-issuer-software'),
    path('issuers/<str:nit>/ranges/', issuers.list_ranges, name='list-issuer-ranges'),
    path('issuers/<str:nit>/ranges/create/', issuers.create_range, name='create-issuer-range'),
    path('issuers/<str:nit>/test-set/', issuer_habilitation.retrieve_test_set, name='retrieve-issuer-test-set'),
    path('issuers/<str:nit>/test-set/start/', issuer_habilitation.start_test_set, name='start-issuer-test-set'),
    path('issuers/<str:nit>/test-set/check/', issuer_habilitation.check_test_set, name='check-issuer-test-set'),
    path('issuers/<str:nit>/production/', issuer_habilitation.retrieve_production, name='retrieve-issuer-production'),
    path(
        'issuers/<str:nit>/production/copy-software/', issuer_habilitation.copy_production_software,
        name='copy-issuer-production-software',
    ),
    path(
        'issuers/<str:nit>/production/fetch-ranges/', issuer_habilitation.fetch_production_ranges,
        name='fetch-issuer-production-ranges',
    ),
    path('issuers/<str:nit>/production/promote/', issuer_habilitation.promote_to_production, name='promote-issuer'),
]

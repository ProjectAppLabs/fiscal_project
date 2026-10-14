from django.urls import path

from fiscal_app.views import console, console_client_systems, console_onboarding, console_operations

urlpatterns = [
    path('summary/', console.console_summary, name='console-summary'),
    path('documents/', console.console_documents, name='console-documents'),
    path('documents/<int:document_id>/', console.console_document, name='console-document'),
    path('issuers/<int:issuer_id>/contingency-letter/', console.console_contingency_letter, name='console-contingency-letter'),
    path('issuers/', console_operations.console_issuers, name='console-issuers'),
    path('issuers/<int:issuer_id>/', console_operations.console_issuer, name='console-issuer'),
    path('alerts/', console_operations.console_alerts, name='console-alerts'),
    path('alerts/<int:alert_id>/resolve/', console_operations.console_resolve_alert, name='console-resolve-alert'),
    path('contingencies/', console_operations.console_contingencies, name='console-contingencies'),
    path('client-systems/', console_operations.console_client_systems, name='console-client-systems'),
    path(
        'documents/<int:document_id>/artifacts/<str:kind>/', console_operations.console_document_artifact,
        name='console-document-artifact',
    ),
    path('client-systems/create/', console_onboarding.console_create_client_system, name='console-create-client-system'),
    path('client-systems/<int:client_id>/', console_client_systems.console_client_system, name='console-client-system'),
    path('client-systems/<int:client_id>/rotate-secret/', console_client_systems.console_rotate_secret, name='console-rotate-secret'),
    path('client-systems/<int:client_id>/ping/', console_client_systems.console_ping_client_system, name='console-ping-client-system'),
    path('client-systems/<int:client_id>/deliveries/', console_client_systems.console_client_deliveries, name='console-client-deliveries'),
    path(
        'client-systems/<int:client_id>/deliveries/retry-failed/', console_client_systems.console_retry_failed_deliveries,
        name='console-retry-failed-deliveries',
    ),
    path('deliveries/<int:delivery_id>/retry/', console_client_systems.console_retry_delivery, name='console-retry-delivery'),
    path('issuers/create/', console_onboarding.console_create_issuer, name='console-create-issuer'),
    path('issuers/<int:issuer_id>/certificate/', console_onboarding.console_upload_certificate, name='console-upload-certificate'),
    path('issuers/<int:issuer_id>/software/', console_onboarding.console_register_software, name='console-register-software'),
    path('issuers/<int:issuer_id>/ranges/', console_onboarding.console_create_range, name='console-create-range'),
    path('issuers/<int:issuer_id>/test-set/', console_onboarding.console_test_set, name='console-test-set'),
    path('test-sets/<int:run_id>/check/', console_onboarding.console_check_test_set, name='console-check-test-set'),
    path('issuers/<int:issuer_id>/production/', console_onboarding.console_production, name='console-production'),
    path(
        'issuers/<int:issuer_id>/production/<slug:action>/', console_onboarding.console_production_action,
        name='console-production-action',
    ),
]

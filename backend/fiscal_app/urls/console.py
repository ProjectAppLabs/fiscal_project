from django.urls import path

from fiscal_app.views import console, console_operations

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
]

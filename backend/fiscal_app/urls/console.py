from django.urls import path

from fiscal_app.views import console

urlpatterns = [
    path('summary/', console.console_summary, name='console-summary'),
    path('documents/', console.console_documents, name='console-documents'),
    path('documents/<int:document_id>/', console.console_document, name='console-document'),
]

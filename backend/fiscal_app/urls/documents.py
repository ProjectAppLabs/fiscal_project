from django.urls import path

from fiscal_app.views import documents

urlpatterns = [
    path('documents/create/', documents.create_document, name='create-document'),
    path('documents/<int:document_id>/', documents.retrieve_document, name='retrieve-document'),
    path('documents/<int:document_id>/artifacts/<str:kind>/', documents.retrieve_artifact, name='retrieve-document-artifact'),
]

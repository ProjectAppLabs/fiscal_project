"""Tests for downloading document artifacts through the machine API."""

import pytest

from fiscal_app.services.artifacts import store


@pytest.mark.django_db
def test_artifact_is_downloaded_with_its_hash(signed_client, make_document):
    """Fails if the client cannot download a signed XML with its SHA-256 to check it."""
    document = make_document()
    artifact = store(document, 'signed_xml', b'<Invoice/>', 'application/xml')

    response = signed_client.get(f'/api/v1/documents/{document.pk}/artifacts/signed_xml/')

    assert response.content == b'<Invoice/>'
    assert response['X-Fiscal-SHA256'] == artifact.sha256


@pytest.mark.django_db
def test_missing_artifact_answers_not_found(signed_client, make_document):
    """Fails if asking for a file the document does not have yet looks like a server error."""
    document = make_document()

    response = signed_client.get(f'/api/v1/documents/{document.pk}/artifacts/pdf/')

    assert response.json()['error']['code'] == 'artifact_not_found'


@pytest.mark.django_db
def test_other_client_cannot_download_the_artifact(other_signed_client, make_document):
    """Fails if a client system can download another client's signed XML."""
    document = make_document()
    store(document, 'signed_xml', b'<Invoice/>', 'application/xml')

    response = other_signed_client.get(f'/api/v1/documents/{document.pk}/artifacts/signed_xml/')

    assert response.status_code == 404


@pytest.mark.django_db
def test_altered_artifact_is_not_served(signed_client, make_document, artifacts_dir):
    """Fails if a file altered on disk is handed to the client."""
    document = make_document()
    artifact = store(document, 'signed_xml', b'<Invoice/>', 'application/xml')
    (artifacts_dir / artifact.storage_path).write_bytes(b'otro')

    response = signed_client.get(f'/api/v1/documents/{document.pk}/artifacts/signed_xml/')

    assert response.status_code == 503

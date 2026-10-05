"""Tests for the artifact store (files with legal value)."""

from datetime import date

import pytest

from fiscal_app.services.artifacts import (
    ArtifactIntegrityError,
    read,
    retention_date,
    store,
)


@pytest.mark.django_db
def test_stored_artifact_reads_back(make_document):
    """Fails if a stored signed XML cannot be read back byte for byte."""
    artifact = store(make_document(), 'signed_xml', b'<Invoice/>', 'application/xml')

    assert read(artifact) == b'<Invoice/>'
    assert artifact.size == 10


@pytest.mark.django_db
def test_same_content_is_stored_once(make_document):
    """Fails if a retry stores the same file twice."""
    document = make_document()
    first = store(document, 'signed_xml', b'<Invoice/>', 'application/xml')

    second = store(document, 'signed_xml', b'<Invoice/>', 'application/xml')

    assert first.pk == second.pk


@pytest.mark.django_db
def test_altered_file_is_detected(make_document, artifacts_dir):
    """Fails if a file changed on disk is served as if it were the original."""
    artifact = store(make_document(), 'signed_xml', b'<Invoice/>', 'application/xml')
    (artifacts_dir / artifact.storage_path).write_bytes(b'<Invoice>alterado</Invoice>')

    with pytest.raises(ArtifactIntegrityError):
        read(artifact)


@pytest.mark.django_db
def test_path_outside_the_store_is_refused(make_document):
    """Fails if a tampered storage path can read files outside the artifact store."""
    artifact = store(make_document(), 'signed_xml', b'<Invoice/>', 'application/xml')
    artifact.storage_path = '../../../../etc/hostname'

    with pytest.raises(ArtifactIntegrityError):
        read(artifact)


def test_retention_is_ten_years():
    """Fails if artifacts are kept less than the 10 years of Ley 962 de 2005 art. 28."""
    assert retention_date(date(2026, 10, 4)) == date(2036, 10, 4)


def test_retention_from_a_leap_day():
    """Fails if an artifact stored on 29 February breaks the retention date."""
    assert retention_date(date(2028, 2, 29)) == date(2038, 2, 28)

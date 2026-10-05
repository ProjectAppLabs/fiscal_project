"""Tests for the 10-year retention guard on artifacts with legal value."""

from datetime import timedelta

import pytest
from django.db import transaction
from django.utils import timezone

from fiscal_app.models import Artifact
from fiscal_app.signals import RetentionError


@pytest.fixture
def make_artifact(make_document):
    """Build artifacts of one document with the given retention date."""
    document = make_document()

    def build(retain_until):
        return Artifact.objects.create(
            document=document, kind='signed_xml', sha256='a' * 64, size=10, content_type='application/xml',
            storage_path='fiscal/x.xml', retain_until=retain_until,
        )

    return build


@pytest.mark.django_db
def test_retained_artifact_cannot_be_deleted(make_artifact):
    """Fails if a signed XML can be deleted before its retention date."""
    artifact = make_artifact(timezone.localdate() + timedelta(days=3650))

    with pytest.raises(RetentionError):
        artifact.delete()


@pytest.mark.django_db
def test_retained_artifacts_cannot_be_deleted_in_bulk(make_artifact):
    """Fails if a queryset delete bypasses the retention guard."""
    make_artifact(timezone.localdate() + timedelta(days=3650))

    with pytest.raises(RetentionError), transaction.atomic():
        Artifact.objects.all().delete()

    assert Artifact.objects.count() == 1


@pytest.mark.django_db
def test_expired_artifact_can_be_deleted(make_artifact):
    """Fails if an artifact past its retention date can never be removed."""
    artifact = make_artifact(timezone.localdate() - timedelta(days=1))

    artifact.delete()

    assert Artifact.objects.count() == 0

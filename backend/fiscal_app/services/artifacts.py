"""Storage of artifacts with legal value (signed XML, DIAN response, AttachedDocument, PDF, evidence).

Files live under FISCAL_ARTIFACTS_DIR, outside MEDIA_ROOT (which Django serves in development): they are only read
through the signed machine API. Each one is stored with its SHA-256 and checked again when read.
"""

import hashlib
import os
import tempfile
from datetime import date
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from fiscal_app.models import Artifact, Document

EXTENSIONS = {'application/xml': 'xml', 'application/json': 'json', 'application/pdf': 'pdf'}


class ArtifactIntegrityError(Exception):
    """A stored file no longer matches the hash recorded when it was saved."""


def retention_date(today: date | None = None) -> date:
    today = today or timezone.localdate()
    try:
        return today.replace(year=today.year + settings.FISCAL_RETENTION_YEARS)
    except ValueError:  # 29 February
        return today.replace(year=today.year + settings.FISCAL_RETENTION_YEARS, day=28)


def _root() -> Path:
    return Path(settings.FISCAL_ARTIFACTS_DIR)


def store(document: Document, kind: str, content: bytes, content_type: str) -> Artifact:
    """Write the file atomically and record it; the same content twice for one kind is stored once."""
    digest = hashlib.sha256(content).hexdigest()
    existing = document.artifacts.filter(kind=kind, sha256=digest).first()
    if existing:
        return existing
    extension = EXTENSIONS.get(content_type, 'bin')
    relative = Path(document.issuer.nit) / str(document.issue_datetime.year) / str(document.pk) / f'{kind}-{digest[:12]}.{extension}'
    target = _root() / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=target.parent)
    with os.fdopen(handle, 'wb') as stream:
        stream.write(content)
    os.replace(temporary, target)
    return Artifact.objects.create(
        document=document, kind=kind, sha256=digest, size=len(content), content_type=content_type,
        storage_path=str(relative), retain_until=retention_date(),
    )


def read(artifact: Artifact) -> bytes:
    """Return the file content after checking it against its recorded hash."""
    path = (_root() / artifact.storage_path).resolve()
    if _root().resolve() not in path.parents:
        raise ArtifactIntegrityError('La ruta del artefacto está fuera del almacén.')
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != artifact.sha256:
        raise ArtifactIntegrityError(f'El artefacto {artifact.pk} no coincide con su huella SHA-256.')
    return content

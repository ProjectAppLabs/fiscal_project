"""Choices that store DIAN codes as they are (caja de herramientas FE 1.9, listas de valores genericode)."""

from django.db import models


class Environment(models.TextChoices):
    """TipoAmbiente-2.1: the code goes as-is into ProfileExecutionID, the CUFE and the QR URL."""

    PRODUCTION = '1', 'Producción'
    TESTING = '2', 'Pruebas'


class PersonType(models.TextChoices):
    """TipoOrganizacion-2.1."""

    LEGAL = '1', 'Persona jurídica'
    NATURAL = '2', 'Persona natural'


class DocumentKind(models.TextChoices):
    """Documents of stage 1 (D2: electronic invoice for everything)."""

    INVOICE = 'invoice', 'Factura electrónica de venta'
    CREDIT_NOTE = 'credit_note', 'Nota crédito'
    DEBIT_NOTE = 'debit_note', 'Nota débito'


class DocumentState(models.TextChoices):
    QUEUED = 'queued', 'En cola'
    TRANSMITTING = 'transmitting', 'Transmitiendo'
    VALIDATED = 'validated', 'Validado por la DIAN'
    REJECTED = 'rejected', 'Rechazado por la DIAN'
    CONTINGENCY_DIAN = 'contingency_dian', 'Contingencia por falla de la DIAN (tipo 04)'
    CONTINGENCY_ISSUER = 'contingency_issuer', 'Contingencia del emisor (tipo 03)'


class RangeKind(models.TextChoices):
    INVOICE = 'invoice', 'Facturación'
    CONTINGENCY = 'contingency', 'Contingencia (papel o talonario)'


class ArtifactKind(models.TextChoices):
    SIGNED_XML = 'signed_xml', 'XML firmado'
    DIAN_RESPONSE = 'dian_response', 'Respuesta de la DIAN (ApplicationResponse)'
    ATTACHED_DOCUMENT = 'attached_document', 'AttachedDocument'
    PDF = 'pdf', 'Representación gráfica (PDF)'
    EVIDENCE = 'evidence', 'Evidencia de contingencia'

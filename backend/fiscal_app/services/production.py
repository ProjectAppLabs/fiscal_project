"""Move an issuer from habilitación to production once the DIAN has enabled it.

Order of the real world (DIAN instructivo): the test set is accepted, the business marks itself «Habilitado» in the
portal (choosing the irreversible start date), asks for its numbering in MUISCA, and associates its prefixes. Fiscal.
then needs the production software (normally the same SoftwareID and PIN), the production ranges with their technical
keys and the real gateway; only then the issuer's environment becomes production (1).

GetNumberingRange (annex §7.15) only answers in production and returns each range with its technical key. For
«software propio o adquirido» the software owner (accountCodeT) is the issuer itself.
"""

from datetime import date

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from dian import soap
from dian.gateway import DianUnavailable
from fiscal_app.models import Issuer, NumberingRange, SoftwareRegistration, TestSetRun
from fiscal_app.models.choices import Environment, RangeKind
from fiscal_app.services.certificates import active_certificate, credentials_of
from fiscal_app.services.software import register_software

# The DIAN's shared habilitación resolution (SETP 990000000-995000000), the same for every facturador.
HABILITATION_RESOLUTION = '18760000001'


class ProductionError(Exception):
    """The issuer cannot move to production yet; the message says why."""


def readiness(issuer: Issuer) -> dict:
    today = timezone.localdate()
    return {
        'test_set_accepted': issuer.test_set_runs.filter(state=TestSetRun.State.ACCEPTED).exists(),
        'certificate': active_certificate(issuer) is not None,
        'software': _software(issuer) is not None,
        'range': NumberingRange.objects.filter(
            issuer=issuer, kind=RangeKind.INVOICE, active=True, valid_from__lte=today, valid_to__gte=today,
        ).exclude(resolution_number=HABILITATION_RESOLUTION).exclude(technical_key='').exists(),
        'gateway': settings.DIAN_GATEWAY == 'soap',
    }


def copy_habilitation_software(issuer: Issuer) -> SoftwareRegistration:
    """Production software with the SoftwareID and PIN registered for habilitación."""
    testing = (
        SoftwareRegistration.objects.filter(issuer=issuer, environment=Environment.TESTING, active=True)
        .order_by('-created_at').first()
    )
    if testing is None:
        raise ProductionError('El emisor no tiene software registrado en habilitación para copiar.')
    return register_software(issuer, {
        'environment': Environment.PRODUCTION, 'software_id': testing.software_id, 'software_pin': testing.software_pin,
        'test_set_id': '',
    })


def fetch_ranges(issuer: Issuer, client_factory=None) -> list[NumberingRange]:
    """Ask the DIAN (production) for the issuer's ranges and store them with their technical keys."""
    software = _software(issuer)
    certificate = active_certificate(issuer)
    if software is None or certificate is None:
        raise ProductionError('Primero registra el software de producción y el certificado.')
    factory = client_factory or (lambda credentials: soap.DianClient(
        credentials, Environment.PRODUCTION, url=settings.DIAN_WS_URLS.get(Environment.PRODUCTION) or None,
    ))
    try:
        ranges = factory(credentials_of(certificate)).get_numbering_range(issuer.nit, issuer.nit, software.software_id)
    except (soap.DianServiceError, DianUnavailable) as error:
        raise ProductionError(f'La DIAN no entregó la numeración: {error}') from error
    stored = []
    for item in ranges:
        numbering, _created = NumberingRange.objects.update_or_create(
            issuer=issuer, resolution_number=item.resolution_number, prefix=item.prefix,
            defaults={
                'kind': RangeKind.INVOICE, 'number_from': item.number_from, 'number_to': item.number_to,
                'valid_from': date.fromisoformat(item.valid_from), 'valid_to': date.fromisoformat(item.valid_to),
                'resolution_date': date.fromisoformat(item.resolution_date) if item.resolution_date else None,
                'technical_key': item.technical_key, 'active': True,
            },
        )
        stored.append(numbering)
    return stored


@transaction.atomic
def promote(issuer: Issuer) -> Issuer:
    """Switch the issuer to production when everything is ready; from then on its documents have fiscal effect."""
    issuer = Issuer.objects.select_for_update().get(pk=issuer.pk)
    if issuer.environment == Environment.PRODUCTION:
        return issuer
    missing = [LABELS[name] for name, ready in readiness(issuer).items() if not ready]
    if missing:
        raise ProductionError(f'Todavía falta: {", ".join(missing)}.')
    issuer.environment = Environment.PRODUCTION
    issuer.save(update_fields=['environment', 'updated_at'])
    # The habilitación range must never number a production document.
    issuer.numbering_ranges.filter(resolution_number=HABILITATION_RESOLUTION).update(active=False)
    return issuer


def _software(issuer):
    return (
        SoftwareRegistration.objects.filter(issuer=issuer, environment=Environment.PRODUCTION, active=True)
        .order_by('-created_at').first()
    )


LABELS = {
    'test_set_accepted': 'el set de pruebas aceptado por la DIAN',
    'certificate': 'un certificado activo',
    'software': 'el software de producción',
    'range': 'un rango de numeración de producción vigente con su clave técnica',
    'gateway': 'el gateway real de la DIAN (DIAN_GATEWAY=soap)',
}

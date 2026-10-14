"""Machine API for client systems: run the issuer's DIAN test set and move it to production.

The same services as the operator console (fiscal_app.services.test_set and production), so a client system can
enrol a business end to end without the console.
"""

import logging

from rest_framework import status
from rest_framework.response import Response

from fiscal_app.serializers import TestSetStartSerializer, describe_run
from fiscal_app.services import production, test_set
from fiscal_app.utils.errors import FiscalError

from .issuers import machine_view, own_issuer

logger = logging.getLogger(__name__)


@machine_view(['GET'])
def retrieve_test_set(request, nit):
    """What the issuer has and lacks to run the test set, and its latest run (or null)."""
    issuer = own_issuer(request.user, nit)
    run = issuer.test_set_runs.first()
    return Response({'readiness': test_set.readiness(issuer), 'run': describe_run(run) if run else None})


@machine_view(['POST'])
def start_test_set(request, nit):
    """Sign and send the set's invoices; the notes follow once the DIAN accepts them (on a later check)."""
    issuer = own_issuer(request.user, nit)
    serializer = TestSetStartSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        run = test_set.start(issuer, **serializer.validated_data)
    except test_set.TestSetError as error:
        raise FiscalError(str(error), 'test_set_not_ready', status.HTTP_409_CONFLICT) from error
    logger.info('Set de pruebas %s iniciado para el emisor %s (sistema cliente %s)', run.pk, issuer.pk, request.user.pk)
    return Response(describe_run(run), status=status.HTTP_201_CREATED)


@machine_view(['POST'])
def check_test_set(request, nit):
    """Ask the DIAN for the result of the latest run; a finished run is returned as it is."""
    issuer = own_issuer(request.user, nit)
    run = issuer.test_set_runs.first()
    if run is None:
        raise FiscalError('El emisor no ha iniciado un set de pruebas.', 'test_set_not_found', status.HTTP_404_NOT_FOUND)
    return Response(describe_run(test_set.check(run)))


@machine_view(['GET'])
def retrieve_production(request, nit):
    """The issuer's environment and what it still lacks to move to production."""
    issuer = own_issuer(request.user, nit)
    return Response(_production(issuer))


@machine_view(['POST'])
def copy_production_software(request, nit):
    """Production software with the SoftwareID and PIN of habilitación (the DIAN keeps them)."""
    issuer = own_issuer(request.user, nit)
    _run_step(production.copy_habilitation_software, issuer)
    return Response(_production(issuer))


@machine_view(['POST'])
def fetch_production_ranges(request, nit):
    """Bring the issuer's production numbering, with its technical keys, from the DIAN (GetNumberingRange)."""
    issuer = own_issuer(request.user, nit)
    _run_step(production.fetch_ranges, issuer)
    return Response(_production(issuer))


@machine_view(['POST'])
def promote_to_production(request, nit):
    """Switch the issuer to production. Needs {"confirm": true}: the business must already be «Habilitado»."""
    issuer = own_issuer(request.user, nit)
    if request.data.get('confirm') is not True:
        raise FiscalError('Confirma que el comercio ya quedó «Habilitado» en el portal de la DIAN.',
                          'confirmation_required')
    issuer = _run_step(production.promote, issuer)
    logger.warning('Emisor %s pasó a producción (sistema cliente %s)', issuer.pk, request.user.pk)
    return Response(_production(issuer))


def _run_step(step, issuer):
    try:
        return step(issuer)
    except production.ProductionError as error:
        raise FiscalError(str(error), 'production_not_ready', status.HTTP_409_CONFLICT) from error


def _production(issuer):
    issuer.refresh_from_db()
    return {'environment': issuer.environment, 'readiness': production.readiness(issuer)}

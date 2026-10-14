"""Tests for moving an issuer from habilitación to production (software, numbering from the DIAN and the switch)."""

from datetime import date

import pytest
from freezegun import freeze_time

from dian import soap
from fiscal_app.models import NumberingRange, SoftwareRegistration, TestSetRun
from fiscal_app.services import production

PRODUCTION_RANGE = soap.NumberingRange('18764000000001', '2026-10-20', 'FE', 1, 5000, '2026-10-20', '2028-10-20', 'clave-de-produccion')


class Client:
    def __init__(self, ranges=(), error=None):
        self.ranges, self.error, self.calls = list(ranges), error, []

    def get_numbering_range(self, issuer_nit, owner_nit, software_id):
        self.calls.append((issuer_nit, owner_nit, software_id))
        if self.error:
            raise self.error
        return self.ranges


@pytest.fixture
def enabled_issuer(ready_issuer, settings):
    """An issuer whose test set the DIAN accepted, with the real gateway configured."""
    settings.DIAN_GATEWAY = 'soap'
    TestSetRun.objects.create(issuer=ready_issuer, test_set_id='set', state=TestSetRun.State.ACCEPTED)
    return ready_issuer


@pytest.mark.django_db
def test_fresh_issuer_lists_what_production_needs(ready_issuer):
    """Fails if an issuer only in habilitación looks ready for production (set, software, range, gateway)."""
    assert production.readiness(ready_issuer) == {
        'test_set_accepted': False, 'certificate': True, 'software': False, 'range': False, 'gateway': False,
    }


@pytest.mark.django_db
def test_habilitation_software_is_copied_to_production(ready_issuer):
    """Fails if the production software does not reuse the SoftwareID and PIN registered for habilitación."""
    production.copy_habilitation_software(ready_issuer)

    registration = SoftwareRegistration.objects.get(issuer=ready_issuer, environment='1')
    testing = SoftwareRegistration.objects.get(issuer=ready_issuer, environment='2')
    assert (registration.software_id, registration.software_pin) == (testing.software_id, testing.software_pin)


@pytest.mark.django_db
def test_production_ranges_come_from_the_dian_with_their_key(ready_issuer):
    """Fails if the ranges GetNumberingRange returns are not stored with their technical key (it enters the CUFE)."""
    production.copy_habilitation_software(ready_issuer)
    client = Client([PRODUCTION_RANGE])

    production.fetch_ranges(ready_issuer, client_factory=lambda credentials: client)

    stored = NumberingRange.objects.get(issuer=ready_issuer, prefix='FE')
    assert (stored.number_to, stored.valid_to, stored.technical_key) == (5000, date(2028, 10, 20), 'clave-de-produccion')
    assert client.calls == [(ready_issuer.nit, ready_issuer.nit, 'sw-1')]


@pytest.mark.django_db
def test_dian_failure_fetching_ranges_is_explained(ready_issuer):
    """Fails if a DIAN error while fetching the numbering surfaces as a crash instead of a clear message."""
    production.copy_habilitation_software(ready_issuer)

    with pytest.raises(production.ProductionError, match='La DIAN no entregó la numeración'):
        production.fetch_ranges(ready_issuer, client_factory=lambda credentials: Client(error=soap.DianServiceError('sin permiso')))


@pytest.mark.django_db
def test_issuer_is_not_promoted_while_something_is_missing(enabled_issuer):
    """Fails if an issuer reaches production without production software or numbering."""
    with pytest.raises(production.ProductionError, match='software de producción'):
        production.promote(enabled_issuer)

    enabled_issuer.refresh_from_db()
    assert enabled_issuer.environment == '2'


@pytest.mark.django_db
@freeze_time('2026-10-25 12:00:00')
def test_ready_issuer_moves_to_production_and_leaves_the_test_range(enabled_issuer, invoice_range):
    """Fails if the switch does not happen, or the habilitación range could still number production documents."""
    production.copy_habilitation_software(enabled_issuer)
    production.fetch_ranges(enabled_issuer, client_factory=lambda credentials: Client([PRODUCTION_RANGE]))

    issuer = production.promote(enabled_issuer)

    invoice_range.refresh_from_db()
    assert issuer.environment == '1'
    assert invoice_range.active is False

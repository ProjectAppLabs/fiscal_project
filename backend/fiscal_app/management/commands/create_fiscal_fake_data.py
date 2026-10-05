import hashlib
import json
import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from fiscal_app.models import (
    ClientSecret,
    ClientSystem,
    Document,
    DocumentEvent,
    Issuer,
    NumberingRange,
    SoftwareRegistration,
)
from fiscal_app.models.choices import DocumentKind, DocumentState, Environment, PersonType, RangeKind
from fiscal_app.services.certificates import set_certificate
from fiscal_app.services.nit import check_digit
from fiscal_app.services.self_signed import self_signed_p12

FAKE_CLIENT_NAME = 'Waiter (fake data)'
FAKE_SECRET = 'fake-waiter-secret-for-local-development-only'


class Command(BaseCommand):
    """Fiscal fake data: one client system, one testing issuer and one document per state.

    The issuer uses the DIAN's own testing range (SETP 990000000-995000000, caja de herramientas).
    """

    help = 'Create Fiscal. fake data (client system, issuer, ranges and documents)'

    @transaction.atomic
    def handle(self, *args, **options):
        client, created = ClientSystem.objects.get_or_create(
            name=FAKE_CLIENT_NAME, defaults={'key_id': 'fk_fakewaiter000000000000'}
        )
        if created:
            ClientSecret.objects.create(client=client, secret=FAKE_SECRET)
        issuer = client.issuers.first() or self._issuer(client)
        self._documents(client, issuer)
        self.stdout.write(self.style.SUCCESS(
            f'Fiscal fake data ready: {client.key_id} / {FAKE_SECRET} · issuer {issuer.nit}-{issuer.dv}'
        ))

    def _issuer(self, client):
        nit = str(random.randint(900_000_000, 999_999_999))
        issuer = Issuer.objects.create(
            client=client, nit=nit, dv=check_digit(nit), person_type=PersonType.LEGAL,
            legal_name='Restaurante de Prueba SAS', trade_name='Restaurante de Prueba',
            tax_responsibilities=['O-13'], tax_scheme='01', address_line='Calle 10 # 43-12',
            municipality_code='05001', department_code='05', postal_code='050021',
            email='facturacion@restaurante.test', environment=Environment.TESTING,
        )
        SoftwareRegistration.objects.create(
            issuer=issuer, environment=Environment.TESTING, software_id='00000000-0000-0000-0000-000000000000',
            software_pin='12345', test_set_id='00000000-0000-0000-0000-000000000001',
        )
        set_certificate(issuer, self_signed_p12('Restaurante de Prueba SAS', 'fake-pass'), 'fake-pass')
        today = timezone.localdate()
        NumberingRange.objects.create(
            issuer=issuer, kind=RangeKind.INVOICE, resolution_number='18760000001', prefix='SETP',
            number_from=990_000_000, number_to=995_000_000, valid_from=date(2019, 1, 19), valid_to=date(2030, 1, 19),
            technical_key='fc8eac422eba16e22ffd8c6f94b3f40a6e38162c', establishment='Principal',
        )
        NumberingRange.objects.create(
            issuer=issuer, kind=RangeKind.CONTINGENCY, resolution_number='18760000002', prefix='CONT',
            number_from=1, number_to=5_000, valid_from=today, valid_to=today + timedelta(days=730),
            establishment='Principal',
        )
        return issuer

    def _documents(self, client, issuer):
        invoice_range = issuer.numbering_ranges.get(kind=RangeKind.INVOICE)
        next_number = (
            issuer.documents.filter(prefix=invoice_range.prefix).order_by('-number').values_list('number', flat=True).first()
            or invoice_range.number_from - 1
        ) + 1
        for offset, state in enumerate(DocumentState.values):
            number = next_number + offset
            payload = {'total': '36900.00', 'lines': [{'description': 'Hamburguesa de la casa', 'quantity': 1}]}
            document = Document.objects.create(
                client=client, issuer=issuer, numbering_range=invoice_range,
                idempotency_key=f'fake:{invoice_range.prefix}{number}', kind=DocumentKind.INVOICE,
                prefix=invoice_range.prefix, number=number, issue_datetime=timezone.now(), payload=payload,
                payload_hash=hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest(), state=state,
                errors=[{'code': 'FAD06', 'message': 'Regla de ejemplo incumplida'}] if state == DocumentState.REJECTED else [],
            )
            DocumentEvent.objects.create(document=document, state=state, detail={'source': 'fake data'})

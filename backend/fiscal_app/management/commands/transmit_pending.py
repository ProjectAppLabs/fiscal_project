from django.core.management.base import BaseCommand

from fiscal_app.services.emission import run_once
from fiscal_app.services.webhooks import deliver, pending_deliveries


class Command(BaseCommand):
    help = 'Transmit due documents and deliver pending notices now (development and manual operation).'

    def add_arguments(self, parser):
        parser.add_argument('--batch', type=int, default=50)

    def handle(self, *args, batch, **options):
        transmitted = run_once(batch)
        delivered = sum(1 for delivery in pending_deliveries()[:batch] if deliver(delivery))
        self.stdout.write(f'Documentos procesados: {transmitted} · avisos entregados: {delivered}')

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError

from fiscal_app.models import ClientSystem
from fiscal_app.services.client_systems import rotate_secret


class Command(BaseCommand):
    help = 'Issue a new secret for a client system; the previous one keeps working during the grace period.'

    def add_arguments(self, parser):
        parser.add_argument('key_id')
        parser.add_argument('--grace-hours', type=int, default=24)

    def handle(self, *args, key_id, grace_hours, **options):
        client = ClientSystem.objects.filter(key_id=key_id).first()
        if client is None:
            raise CommandError('No hay un sistema cliente con ese identificador.')
        secret = rotate_secret(client, timedelta(hours=grace_hours))
        self.stdout.write(f'FISCAL_SECRET={secret}')
        self.stdout.write(
            self.style.WARNING(f'El secreto anterior sigue sirviendo {grace_hours} h. Este no se vuelve a mostrar.')
        )

from django.core.management.base import BaseCommand, CommandError

from fiscal_app.models import ClientSystem
from fiscal_app.services.client_systems import create_client_system


class Command(BaseCommand):
    help = 'Register a client system (e.g. Waiter) and print its key id and secret once.'

    def add_arguments(self, parser):
        parser.add_argument('name')
        parser.add_argument('--webhook-url', default='')

    def handle(self, *args, name, webhook_url, **options):
        if ClientSystem.objects.filter(name=name).exists():
            raise CommandError(f'Ya existe un sistema cliente llamado «{name}».')
        client, secret = create_client_system(name, webhook_url)
        self.stdout.write(f'FISCAL_KEY_ID={client.key_id}')
        self.stdout.write(f'FISCAL_SECRET={secret}')
        self.stdout.write(self.style.WARNING('Guarda el secreto en el sistema cliente: no se vuelve a mostrar.'))

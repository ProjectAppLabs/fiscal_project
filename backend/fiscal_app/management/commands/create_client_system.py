from django.core.management.base import BaseCommand, CommandError

from fiscal_app.models import ClientSystem
from fiscal_app.services.client_systems import create_client_system
from fiscal_app.services.origins import check_webhook_domain, normalize_host


class Command(BaseCommand):
    help = 'Register a client system (e.g. Waiter) and print its key id and secret once.'

    def add_arguments(self, parser):
        parser.add_argument('name')
        parser.add_argument('--webhook-url', default='')
        parser.add_argument('--domain', default='', help='Domain the client system calls from, e.g. waiter.co.')
        parser.add_argument('--allow-subdomains', action='store_true', help='Also accept any subdomain of --domain.')

    def handle(self, *args, name, webhook_url, domain, allow_subdomains, **options):
        if ClientSystem.objects.filter(name=name).exists():
            raise CommandError(f'Ya existe un sistema cliente llamado «{name}».')
        host = normalize_host(domain) if domain else ''
        if domain and not host:
            raise CommandError(f'«{domain}» no es un dominio válido.')
        try:
            check_webhook_domain(webhook_url, host, allow_subdomains)
        except ValueError as error:
            raise CommandError(str(error)) from error
        client, secret = create_client_system(name, webhook_url, domain=host, allow_subdomains=allow_subdomains)
        self.stdout.write(f'FISCAL_KEY_ID={client.key_id}')
        self.stdout.write(f'FISCAL_SECRET={secret}')
        self.stdout.write(self.style.WARNING('Guarda el secreto en el sistema cliente: no se vuelve a mostrar.'))

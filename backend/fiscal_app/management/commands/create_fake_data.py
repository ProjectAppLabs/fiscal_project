from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    """
    Create fake data for development and E2E runs.

    Usage:
        python3 manage.py create_fake_data [number_of_records]
        python3 manage.py create_fake_data --users 10

    Also creates the Fiscal. data: a client system, a testing issuer and one document per state.
    """

    help = 'Create fake data in the database for all models'

    def add_arguments(self, parser):
        parser.add_argument('number_of_records', type=int, nargs='?', default=None)
        parser.add_argument('--users', type=int, default=10)

    def handle(self, *args, **options):
        number_of_records = options['number_of_records']
        users = number_of_records if number_of_records is not None else options['users']

        self.stdout.write(self.style.SUCCESS('==== Creating Fake Data ===='))
        self.stdout.write(self.style.SUCCESS('\n--- Creating Users ---'))
        call_command('create_users', number_of_users=users)
        self.stdout.write(self.style.SUCCESS('\n--- Creating Fiscal data ---'))
        call_command('create_fiscal_fake_data')
        self.stdout.write(self.style.SUCCESS('\n==== Fake Data Creation Complete ===='))

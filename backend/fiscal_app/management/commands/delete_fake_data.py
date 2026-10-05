from django.core.management.base import BaseCommand, CommandError

from fiscal_app.models import User


class Command(BaseCommand):
    """
    Delete fake records from the database.

    Usage:
        python3 manage.py delete_fake_data --confirm

    Superusers and staff accounts are never deleted.
    """

    help = 'Delete fake records from the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm deletion of all fake data.',
        )

    def handle(self, *args, **options):
        if not options.get('confirm'):
            raise CommandError('Deletion not confirmed. Re-run with --confirm.')

        self.stdout.write(self.style.SUCCESS('==== Deleting Fake Data ===='))
        users_to_delete = User.objects.filter(is_superuser=False, is_staff=False)
        user_count = users_to_delete.count()
        protected_count = User.objects.filter(is_staff=True).count() + User.objects.filter(
            is_superuser=True, is_staff=False
        ).count()
        users_to_delete.delete()
        self.stdout.write(self.style.SUCCESS(f'{user_count} Users deleted'))
        self.stdout.write(self.style.WARNING(f'{protected_count} Admin/Superuser accounts protected and not deleted'))
        self.stdout.write(self.style.SUCCESS('\n==== Fake Data Deletion Complete ===='))

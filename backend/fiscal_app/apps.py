from django.apps import AppConfig


class FiscalAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'fiscal_app'

    def ready(self):
        # Registers the artifact retention guard (pre_delete).
        from . import signals  # noqa: F401

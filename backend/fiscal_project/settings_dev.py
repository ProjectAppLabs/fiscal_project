"""
Development settings for fiscal_project.

Usage: DJANGO_SETTINGS_MODULE=fiscal_project.settings_dev

Note: The default DJANGO_SETTINGS_MODULE in manage.py points to
fiscal_project.settings (base). Use this file explicitly
when you want development-specific overrides (DEBUG=True, console email).
"""

from .settings import *  # noqa: F401,F403

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '*']

# The database comes from backend/.env (MySQL in fiscal-mysql by default; see .env.example).

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

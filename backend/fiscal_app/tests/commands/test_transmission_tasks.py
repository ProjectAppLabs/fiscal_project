"""Tests for the transmission command and the Huey tasks that drive the queue."""

from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from fiscal_project.tasks import (
    deliver_pending_webhooks,
    transmit_due,
    transmit_due_every_minute,
)

from fiscal_app.models.choices import DocumentState


@pytest.mark.django_db
def test_transmit_pending_processes_the_queue(queued_document):
    """Fails if the manual command does not transmit what is due."""
    out = StringIO()

    call_command('transmit_pending', stdout=out)

    queued_document.refresh_from_db()
    assert queued_document.state == DocumentState.VALIDATED
    assert 'Documentos procesados: 1' in out.getvalue()


def test_transmit_due_runs_the_queue():
    """Fails if the task queued after a document arrives does not run the transmission queue."""
    with patch('fiscal_app.services.emission.run_once', return_value=3) as run_once:
        transmit_due.call_local()

    run_once.assert_called_once_with()


def test_periodic_sweep_runs_the_queue():
    """Fails if the every-minute sweep (retries and contingency polls) does not run the queue."""
    with patch('fiscal_app.services.emission.run_once', return_value=0) as run_once:
        transmit_due_every_minute.call_local()

    run_once.assert_called_once_with()


@pytest.mark.django_db
def test_periodic_notice_sweep_counts_delivered_notices():
    """Fails if the notice sweep fails when nothing is pending."""
    assert deliver_pending_webhooks.call_local() == 0

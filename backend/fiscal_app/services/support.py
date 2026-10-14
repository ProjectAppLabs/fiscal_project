"""What an operator can do for a document from the console (H-28): transmit it now, ask the DIAN about it, resend its
notice. Nothing here changes a document's number nor its CUFE, and every action stays in its history.
"""

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from dian import soap
from dian.gateway import DianUnavailable
from fiscal_app.models import Document, DocumentEvent, WebhookDelivery
from fiscal_app.models.choices import DocumentState
from fiscal_app.services.certificates import active_certificate, credentials_of
from fiscal_app.services.webhooks import deliver, enqueue_notice

TRANSMITTABLE = (DocumentState.QUEUED, DocumentState.CONTINGENCY_DIAN)


class SupportError(Exception):
    """The action does not apply to this document; the message says why."""

    def __init__(self, message, code):
        super().__init__(message)
        self.code = code


def request_transmission(document: Document, operator) -> Document:
    """Move a queued document or one in DIAN contingency to the front of the queue and run the sweep now."""
    from fiscal_app.services.documents import _schedule_transmission

    if document.state not in TRANSMITTABLE:
        raise SupportError('Solo se transmite de nuevo un documento en cola o en contingencia de la DIAN.', 'not_transmittable')
    with transaction.atomic():
        Document.objects.filter(pk=document.pk).update(next_attempt_at=timezone.now())
        _record(document, f'Transmisión pedida desde la consola por {_who(operator)}.')
        transaction.on_commit(_schedule_transmission)
    document.refresh_from_db()
    return document


def ask_dian(document: Document, operator, client_factory=None) -> dict:
    """GetStatus by CUFE/CUDE: what the DIAN says about the document now. It only informs; the state does not change."""
    if settings.DIAN_GATEWAY != 'soap':
        raise SupportError('La consulta a la DIAN necesita la conexión real (DIAN_GATEWAY=soap).', 'dian_unavailable')
    if not document.cufe:
        raise SupportError('El documento todavía no tiene CUFE: no se ha firmado.', 'no_cufe')
    certificate = active_certificate(document.issuer)
    if certificate is None:
        raise SupportError('El emisor no tiene certificado activo para consultar a la DIAN.', 'no_certificate')
    factory = client_factory or (lambda credentials, environment: soap.DianClient(
        credentials, environment, url=settings.DIAN_WS_URLS.get(environment) or None,
    ))
    try:
        response = factory(credentials_of(certificate), document.issuer.environment).get_status(document.cufe)
    except (soap.DianServiceError, DianUnavailable) as error:
        raise SupportError(f'La DIAN no respondió: {error}', 'dian_unavailable') from error
    answer = {
        'is_valid': response.is_valid, 'status_code': response.status_code,
        'status_description': response.status_description, 'status_message': response.status_message,
        'messages': [message.as_dict() for message in response.messages],
    }
    _record(document, f'Consulta a la DIAN desde la consola por {_who(operator)}: {response.status_description or response.status_code}.')
    return answer


def resend_notice(document: Document, operator) -> WebhookDelivery:
    """Send the document's current state to its client system again, now."""
    delivery = enqueue_notice(document)
    if delivery is None:
        raise SupportError('El sistema cliente no tiene URL de avisos.', 'no_webhook')
    deliver(delivery)
    delivery.refresh_from_db()
    _record(document, f'Aviso reenviado desde la consola por {_who(operator)}.')
    return delivery


def _record(document, text):
    DocumentEvent.objects.create(document=document, state=document.state, detail={'text': text})


def _who(operator):
    return f'{operator.first_name} {operator.last_name}'.strip() or operator.email

"""Boundary between Fiscal. and the DIAN. The emission service only knows this interface.

F2 implements the real gateway (UBL 2.1, CUFE/CUDE, XAdES-EPES signature, SOAP with WS-Security); until then the
simulated one stands in for development and tests.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class DianUnavailable(Exception):
    """The DIAN did not answer usefully; the same document is retried without changing its number or code.

    `kind` follows the annex FE 1.9 §12.4: 'error' (HTTP 500/503/507/508/403) is retried every 5 s, three times;
    'delay' (no answer within a minute or a timeout) every 2 minutes, five times. After that, contingency type 04.
    """

    def __init__(self, message: str, kind: str = 'error'):
        super().__init__(message)
        self.kind = kind


class GatewayRefused(Exception):
    """The configured gateway must not handle this document (e.g. the simulator and a production issuer)."""


@dataclass(frozen=True)
class Submission:
    """Everything the gateway needs about one document; no Django objects cross this boundary."""

    document_id: int
    kind: str
    environment: str
    issuer_nit: str
    prefix: str
    number: int
    issue_datetime: str
    payload: dict
    payload_hash: str


@dataclass(frozen=True)
class GatewayResult:
    state: str  # 'validated' or 'rejected'
    cufe: str = ''
    qr_url: str = ''
    errors: list = field(default_factory=list)
    signed_xml: bytes = b''
    dian_response: bytes = b''
    invoice_type: str = ''  # InvoiceTypeCode of the XML sent; empty for notes


@dataclass(frozen=True)
class ContingencyDocument:
    """The invoice signed again as type 04 (annex FE 1.9 §12.2): same number and CUFE, delivered without validation."""

    signed_xml: bytes
    cufe: str
    qr_url: str


class DianGateway(ABC):
    @abstractmethod
    def send(self, submission: Submission) -> GatewayResult:
        """Send one document. Must be safe to call again with the same submission."""

    def prepare_contingency(self, submission: Submission) -> ContingencyDocument | None:
        """Sign the invoice as type 04 when the DIAN is unavailable; None when the gateway has no real XML."""
        return None

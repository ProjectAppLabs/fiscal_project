import type {
  ConsoleSummary,
  DocumentDetail,
  DocumentListItem,
  DocumentPage,
  ServiceHealth,
} from '../services/console';

export const TEST_ISSUER = { nit: '900373115', legal_name: 'Restaurante de Prueba SAS' };

export function buildSummary(overrides: Partial<ConsoleSummary> = {}): ConsoleSummary {
  return {
    documents: {
      total: 12,
      by_state: {
        queued: 2,
        transmitting: 0,
        validated: 8,
        rejected: 1,
        contingency_dian: 1,
        contingency_issuer: 0,
      },
    },
    issuers: 3,
    client_systems: 4,
    queue: { due: 5, oldest_queued_at: '2026-10-04T15:00:00Z' },
    last_rejection: {
      id: 7,
      full_number: 'SETP990000007',
      issuer: TEST_ISSUER,
      errors: [{ rule: 'FAD06', message: 'El CUFE no corresponde.' }],
      at: '2026-10-04T15:01:00Z',
    },
    alerts: { total: 3, critical: 1 },
    rejection_rate_24h: 0.125,
    health: buildHealth(),
    ...overrides,
  };
}

export function buildHealth(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    status: 'ok',
    database: 'ok',
    queue: { due: 0, oldest_due_seconds: 0, ok: true },
    worker: { last_beat_at: '2026-10-05T12:00:00Z', ok: true },
    dian: { in_contingency: 0, last_answer_at: '2026-10-05T11:59:00Z' },
    ...overrides,
  };
}

export function buildEmptySummary(): ConsoleSummary {
  return buildSummary({
    documents: {
      total: 0,
      by_state: { queued: 0, transmitting: 0, validated: 0, rejected: 0, contingency_dian: 0, contingency_issuer: 0 },
    },
    queue: { due: 0, oldest_queued_at: null },
    last_rejection: null,
  });
}

export function buildDocument(overrides: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: 7,
    client: 'Waiter',
    issuer: TEST_ISSUER,
    kind: 'invoice',
    full_number: 'SETP990000007',
    state: 'rejected',
    attempts: 1,
    issue_datetime: '2026-10-04T14:59:00Z',
    created_at: '2026-10-04T15:00:00Z',
    validated_at: null,
    ...overrides,
  };
}

export function buildDocumentPage(overrides: Partial<DocumentPage> = {}): DocumentPage {
  return {
    count: 1,
    next: null,
    previous: null,
    results: [buildDocument()],
    ...overrides,
  };
}

export function buildDocumentDetail(overrides: Partial<DocumentDetail> = {}): DocumentDetail {
  return {
    ...buildDocument(),
    idempotency_key: 'waiter-order-42',
    invoice_type: '01',
    contingency_started_at: null,
    cufe: 'a1b2c3d4e5f6a7b8c9d0',
    qr_url: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=a1b2c3',
    errors: [{ rule: 'FAD06', message: 'El CUFE no corresponde.' }],
    original: null,
    payload: { lines: [] },
    artifacts: [
      {
        kind: 'signed_xml',
        sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        size: 2048,
        content_type: 'application/xml',
        created_at: '2026-10-04T15:00:30Z',
      },
    ],
    events: [{ state: 'rejected', detail: 'La DIAN rechazó el documento.', created_at: '2026-10-04T15:01:00Z' }],
    ...overrides,
  };
}

export function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { detail: 'No encontrado.' } } });
}

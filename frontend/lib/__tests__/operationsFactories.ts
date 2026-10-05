import type {
  Alert,
  ClientSystemRow,
  Contingency,
  IssuerDetail,
  IssuerListItem,
  Paginated,
} from '../services/operations';

export function buildIssuer(overrides: Partial<IssuerListItem> = {}): IssuerListItem {
  return {
    id: 3,
    nit: '900373115',
    dv: '3',
    legal_name: 'Restaurante de Prueba SAS',
    environment: '2',
    active: true,
    client: 'Waiter',
    documents: 12,
    open_alerts: 1,
    certificate_expires: '2027-10-05T00:00:00Z',
    ...overrides,
  };
}

export function buildPage<T>(results: T[], overrides: Partial<Paginated<T>> = {}): Paginated<T> {
  return { count: results.length, next: null, previous: null, results, ...overrides };
}

export function buildAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 11,
    kind: 'certificate_expiring',
    severity: 'warning',
    message: 'El certificado de Restaurante de Prueba SAS vence el 2026-11-01 (27 días).',
    issuer: { id: 3, nit: '900373115', legal_name: 'Restaurante de Prueba SAS' },
    document: null,
    created_at: '2026-10-05T12:00:00Z',
    resolved_at: null,
    ...overrides,
  };
}

export function buildIssuerDetail(overrides: Partial<IssuerDetail> = {}): IssuerDetail {
  const { documents: _documents, open_alerts: _alerts, certificate_expires: _expires, ...issuer } = buildIssuer();
  return {
    ...issuer,
    person_type: '1',
    trade_name: 'La Casa',
    tax_responsibilities: ['R-99-PN'],
    address: { line: 'Calle 10 #43-12', municipality_code: '05001' },
    email: 'facturas@restaurante.co',
    certificates: [
      {
        id: 1,
        subject: 'CN=Restaurante de Prueba SAS',
        issued_by: 'CN=Entidad de Certificación',
        serial: 'a1',
        not_before: '2026-01-01T00:00:00Z',
        not_after: '2027-01-01T00:00:00Z',
        active: true,
      },
    ],
    software: [{ environment: '2', software_id: 'sw-123', has_test_set: true, active: true, created_at: '2026-10-01T00:00:00Z' }],
    ranges: [
      {
        id: 5,
        kind: 'invoice',
        resolution_number: '18760000001',
        prefix: 'SETP',
        number_from: 990000000,
        number_to: 995000000,
        valid_from: '2019-01-19',
        valid_to: '2030-01-19',
        active: true,
        establishment: '',
        last_number: 990000007,
        used_share: 0.95,
      },
    ],
    alerts: [buildAlert()],
    ...overrides,
  };
}

export function buildContingency(overrides: Partial<Contingency> = {}): Contingency {
  return {
    id: 21,
    full_number: 'SETP990000021',
    state: 'contingency_dian',
    contingency: 'dian',
    invoice_type: '04',
    issuer: { nit: '900373115', legal_name: 'Restaurante de Prueba SAS' },
    client: 'Waiter',
    started_at: '2026-10-04T12:00:00Z',
    deadline_at: '2026-10-06T12:00:00Z',
    hours_left: 18,
    attempts: 6,
    ...overrides,
  };
}

export function buildClientSystem(overrides: Partial<ClientSystemRow> = {}): ClientSystemRow {
  return {
    id: 1,
    name: 'Waiter',
    key_id: 'fk_waiter',
    webhook_url: 'https://waiter.local/fiscal/avisos/',
    active: true,
    valid_secrets: 1,
    issuers: 2,
    pending_notices: 0,
    failed_notices: 1,
    last_delivered_at: '2026-10-05T11:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

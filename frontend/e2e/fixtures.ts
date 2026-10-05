/**
 * E2E fixtures and helpers.
 *
 * The backend is stubbed per test with `page.route` for auth and console
 * responses, so the specs do not depend on seeded users or documents.
 */

import type { BrowserContext, Page, Route } from '@playwright/test';

export const testOperator = {
  id: 1,
  email: 'operadora@example.com',
  password: 'clave-segura-123',
  first_name: 'Ana',
  last_name: 'Operadora',
  role: 'operator',
  is_staff: true,
};

export const testPasscode = '123456';

const FAKE_ACCESS_TOKEN = 'e2e-access-token';
const FAKE_REFRESH_TOKEN = 'e2e-refresh-token';

function operatorPayload() {
  const { password: _password, ...user } = testOperator;
  return user;
}

function fulfillJson(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** Wait for the page to finish loading (DOM and resources, not network idle). */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('domcontentloaded');
}

/** Stub `validate_token/` so a stored session survives the client-side restore. */
export async function stubValidToken(page: Page) {
  await page.route('**/api/validate_token/', (route) => fulfillJson(route, 200, { user: operatorPayload() }));
}

/** Stub the reCAPTCHA site key as empty so the sign-in form does not require it. */
export async function stubNoCaptcha(page: Page) {
  await page.route('**/api/google-captcha/site-key/', (route) => fulfillJson(route, 200, { site_key: '' }));
}

/** Stub `sign_in/` with a successful token response. */
export async function stubSignInSuccess(page: Page) {
  await page.route('**/api/sign_in/', (route) =>
    fulfillJson(route, 200, { access: FAKE_ACCESS_TOKEN, refresh: FAKE_REFRESH_TOKEN, user: operatorPayload() })
  );
}

/** Stub `sign_in/` with a rejection carrying the backend's error message. */
export async function stubSignInRejected(page: Page, message: string) {
  await page.route('**/api/sign_in/', (route) => fulfillJson(route, 401, { error: message }));
}

/** Stub `send_passcode/` with the given status. */
export async function stubSendPasscode(page: Page, status: number, body: unknown = {}) {
  await page.route('**/api/send_passcode/', (route) => fulfillJson(route, status, body));
}

/** Stub `staging-banner/` as hidden: with the fake token the real backend answers 401. */
export async function stubHiddenStagingBanner(page: Page) {
  await page.route('**/api/staging-banner/', (route) =>
    fulfillJson(route, 200, {
      is_visible: false,
      current_phase: 'development',
      phase_labels: { es: 'Desarrollo', en: 'Development' },
      started_at: null,
      expires_at: null,
      days_remaining: null,
      is_expired: false,
      contact_whatsapp: '',
      contact_email: '',
    }),
  );
}

/**
 * Start the test already signed in: token cookies, a valid `validate_token/` and every other call the shell makes
 * stubbed. An unstubbed call reaches the real backend with the fake token, gets 401, fails the token refresh and
 * signs the operator out in the middle of the test.
 */
export async function signInWithCookies(context: BrowserContext, page: Page, baseURL: string) {
  await context.addCookies([
    { name: 'access_token', value: FAKE_ACCESS_TOKEN, url: baseURL },
    { name: 'refresh_token', value: FAKE_REFRESH_TOKEN, url: baseURL },
  ]);
  await stubValidToken(page);
  await stubHiddenStagingBanner(page);
}

/** Start the test without any session or stored user. */
export async function clearSession(context: BrowserContext, page: Page) {
  await context.clearCookies();
  await page.addInitScript(() => localStorage.clear());
}

// ── Console (dashboard, documents) ──

const testIssuer = { nit: '900373115', legal_name: 'Restaurante de Prueba SAS' };

/** A NIT no stubbed document belongs to. */
export const unknownIssuerNit = '800000000';

export const rejectedDocument = {
  id: 7,
  client: 'Waiter',
  issuer: testIssuer,
  kind: 'invoice',
  full_number: 'SETP990000007',
  state: 'rejected',
  attempts: 1,
  issue_datetime: '2026-10-04T14:59:00Z',
  created_at: '2026-10-04T15:00:00Z',
  validated_at: null,
};

export const validatedDocument = {
  ...rejectedDocument,
  id: 6,
  full_number: 'SETP990000006',
  state: 'validated',
  validated_at: '2026-10-04T14:30:00Z',
};

/** The only document on the second page of the stubbed list. */
export const olderDocument = {
  ...validatedDocument,
  id: 5,
  full_number: 'SETP990000005',
};

export const rejectedDocumentDetail = {
  ...rejectedDocument,
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
  events: [
    { state: 'queued', detail: '', created_at: '2026-10-04T15:00:00Z' },
    { state: 'rejected', detail: 'La DIAN rechazó el documento.', created_at: '2026-10-04T15:01:00Z' },
  ],
};

const healthyService = {
  status: 'ok',
  database: 'ok',
  queue: { due: 0, oldest_due_seconds: 0, ok: true },
  worker: { last_beat_at: '2026-10-05T12:00:00Z', ok: true },
  dian: { in_contingency: 0, last_answer_at: '2026-10-05T11:59:00Z' },
};

export const consoleSummary = {
  documents: {
    total: 12,
    by_state: { queued: 2, transmitting: 0, validated: 8, rejected: 1, contingency_dian: 1, contingency_issuer: 0 },
  },
  issuers: 1,
  client_systems: 1,
  queue: { due: 2, oldest_queued_at: '2026-10-04T15:00:00Z' },
  last_rejection: {
    id: rejectedDocument.id,
    full_number: rejectedDocument.full_number,
    issuer: testIssuer,
    errors: rejectedDocumentDetail.errors,
    at: '2026-10-04T15:01:00Z',
  },
  alerts: { total: 2, critical: 1 },
  rejection_rate_24h: 0.1,
  health: healthyService,
};

export const emptyConsoleSummary = {
  documents: {
    total: 0,
    by_state: { queued: 0, transmitting: 0, validated: 0, rejected: 0, contingency_dian: 0, contingency_issuer: 0 },
  },
  issuers: 1,
  client_systems: 1,
  queue: { due: 0, oldest_queued_at: null },
  last_rejection: null,
  alerts: { total: 0, critical: 0 },
  rejection_rate_24h: null,
  health: healthyService,
};

const DOCUMENT_LIST_URL = /\/api\/console\/documents\/?(\?.*)?$/;
const DOCUMENT_DETAIL_URL = /\/api\/console\/documents\/\d+\/?$/;
const DOCUMENTS_PAGE_SIZE = 25;

/** Stub `console/summary/` with the given body. */
export async function stubConsoleSummary(page: Page, body: unknown = consoleSummary) {
  await page.route('**/api/console/summary/', (route) => fulfillJson(route, 200, body));
}

/** Stub `console/summary/` with a server error on every call. */
export async function stubConsoleSummaryFailing(page: Page) {
  await page.route('**/api/console/summary/', (route) => fulfillJson(route, 500, { detail: 'Error' }));
}

/** Stub `console/summary/` to fail once and then answer with the counters. */
export async function stubConsoleSummaryFailingUntilRecovered(page: Page): Promise<() => void> {
  // Fails every call until the test recovers it: React may fetch twice on mount in development (StrictMode), so
  // "fail only the first call" would let the second succeed before the error is ever shown.
  let recovered = false;
  await page.route('**/api/console/summary/', (route) =>
    recovered ? fulfillJson(route, 200, consoleSummary) : fulfillJson(route, 500, { detail: 'Error' }),
  );
  return () => {
    recovered = true;
  };
}

/**
 * Stub `console/documents/` like the backend: `state` and `issuer` filter the
 * two first-page documents, and `page=2` holds one older document.
 */
export async function stubDocumentList(page: Page) {
  await page.route(DOCUMENT_LIST_URL, (route) => {
    const params = new URL(route.request().url()).searchParams;
    const pageNumber = Number(params.get('page') ?? '1');
    const firstPage = [rejectedDocument, validatedDocument].filter(
      (document) =>
        (!params.get('state') || document.state === params.get('state')) &&
        (!params.get('issuer') || document.issuer.nit === params.get('issuer'))
    );
    const isFiltered = params.has('state') || params.has('issuer');
    const total = isFiltered ? firstPage.length : DOCUMENTS_PAGE_SIZE + 1;
    const listUrl = route.request().url().split('?')[0];

    return fulfillJson(route, 200, {
      count: total,
      next: !isFiltered && pageNumber === 1 ? `${listUrl}?page=2` : null,
      previous: pageNumber === 2 ? listUrl : null,
      results: pageNumber === 2 ? [olderDocument] : firstPage,
    });
  });
}

/** Stub `console/documents/<id>/`: the rejected document exists, anything else is a 404. */
export async function stubDocumentDetail(page: Page) {
  await page.route(DOCUMENT_DETAIL_URL, (route) => {
    const id = Number(route.request().url().match(/documents\/(\d+)/)?.[1]);
    return id === rejectedDocumentDetail.id
      ? fulfillJson(route, 200, rejectedDocumentDetail)
      : fulfillJson(route, 404, { detail: 'No encontrado.' });
  });
}

/** Stub the console download of the rejected document's signed XML. */
export async function stubArtifactDownload(page: Page) {
  await page.route(/\/api\/console\/documents\/\d+\/artifacts\/[a-z_]+\/$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/xml', body: '<Invoice/>' }),
  );
}

// ── Console (issuers) ──

export const testIssuerRow = {
  id: 3,
  nit: testIssuer.nit,
  dv: '3',
  legal_name: testIssuer.legal_name,
  environment: '2',
  active: true,
  client: 'Waiter',
  documents: 12,
  open_alerts: 1,
  certificate_expires: '2027-10-05T00:00:00Z',
};

export const otherIssuerRow = { ...testIssuerRow, id: 4, nit: '901000000', dv: '1', legal_name: 'Panadería La Espiga SAS', open_alerts: 0 };

export const testIssuerDetail = {
  id: 3,
  nit: testIssuer.nit,
  dv: '3',
  legal_name: testIssuer.legal_name,
  environment: '2',
  active: true,
  client: 'Waiter',
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
      not_after: '2027-10-05T00:00:00Z',
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
      last_number: 994750000,
      used_share: 0.95,
    },
  ],
  alerts: [
    {
      id: 11,
      kind: 'range_low',
      severity: 'warning',
      message: 'Al rango SETP le quedan 250000 números.',
      issuer: { id: 3, nit: testIssuer.nit, legal_name: testIssuer.legal_name },
      document: null,
      created_at: '2026-10-05T12:00:00Z',
      resolved_at: null,
    },
  ],
};

/** Stub `console/issuers/` like the backend: `q` matches the NIT prefix or the name. */
export async function stubIssuerList(page: Page) {
  await page.route(/\/api\/console\/issuers\/?(\?.*)?$/, (route) => {
    const query = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase();
    const results = [testIssuerRow, otherIssuerRow].filter(
      (issuer) => !query || issuer.nit.startsWith(query) || issuer.legal_name.toLowerCase().includes(query),
    );
    return fulfillJson(route, 200, { count: results.length, next: null, previous: null, results });
  });
}

/** Stub `console/issuers/<id>/`: the test issuer exists, anything else is a 404. */
export async function stubIssuerDetail(page: Page) {
  await page.route(/\/api\/console\/issuers\/\d+\/$/, (route) => {
    const id = Number(route.request().url().match(/issuers\/(\d+)/)?.[1]);
    return id === testIssuerDetail.id
      ? fulfillJson(route, 200, testIssuerDetail)
      : fulfillJson(route, 404, { detail: 'No encontrado.' });
  });
}

/** Stub the contingency letter: a PDF for an ordered period, 400 when the dates are reversed. */
export async function stubContingencyLetter(page: Page) {
  await page.route(/\/api\/console\/issuers\/\d+\/contingency-letter\/(\?.*)?$/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    if ((params.get('from') ?? '') > (params.get('to') ?? '')) {
      return fulfillJson(route, 400, { code: 'invalid_period', detail: 'La fecha inicial es posterior a la final.' });
    }
    return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' });
  });
}

// ── Console (contingencies, alerts, client systems) ──

export const dianContingency = {
  id: 21,
  full_number: 'SETP990000021',
  state: 'contingency_dian',
  contingency: 'dian',
  invoice_type: '04',
  issuer: testIssuer,
  client: 'Waiter',
  started_at: '2026-10-04T12:00:00Z',
  deadline_at: '2026-10-06T12:00:00Z',
  hours_left: 5.5,
  attempts: 6,
};

/** Stub `console/contingencies/` with one type-04 invoice close to its deadline. */
export async function stubContingencies(page: Page) {
  await page.route('**/api/console/contingencies/', (route) => fulfillJson(route, 200, { count: 1, results: [dianContingency] }));
}

export const rejectionAlert = {
  id: 12,
  kind: 'rejection',
  severity: 'critical',
  message: 'La DIAN rechazó SETP990000007 de Restaurante de Prueba SAS (reglas FAD06).',
  issuer: { id: 3, nit: testIssuer.nit, legal_name: testIssuer.legal_name },
  document: { id: 7, full_number: 'SETP990000007' },
  created_at: '2026-10-05T12:00:00Z',
  resolved_at: null,
};

export const queueAlert = {
  ...rejectionAlert,
  id: 13,
  kind: 'queue_stuck',
  message: 'Hay documentos en cola sin salir desde 2026-10-05 07:00.',
  issuer: null,
  document: null,
};

/** Stub the alerts like the backend: resolving one removes it from the open list. */
export async function stubAlerts(page: Page) {
  const resolved = new Set<number>();
  await page.route(/\/api\/console\/alerts\/(\d+)\/resolve\/$/, (route) => {
    const id = Number(route.request().url().match(/alerts\/(\d+)/)?.[1]);
    resolved.add(id);
    const alert = [rejectionAlert, queueAlert].find((item) => item.id === id);
    return fulfillJson(route, 200, { ...alert, resolved_at: '2026-10-05T13:00:00Z' });
  });
  await page.route(/\/api\/console\/alerts\/?(\?.*)?$/, (route) => {
    const all = new URL(route.request().url()).searchParams.get('state') === 'all';
    const results = [rejectionAlert, queueAlert]
      .map((alert) => (resolved.has(alert.id) ? { ...alert, resolved_at: '2026-10-05T13:00:00Z' } : alert))
      .filter((alert) => all || !alert.resolved_at);
    return fulfillJson(route, 200, { count: results.length, next: null, previous: null, results });
  });
}

export const waiterClient = {
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
};

/** Stub `console/client-systems/` with Waiter and one failed notice. */
export async function stubClientSystems(page: Page) {
  await page.route('**/api/console/client-systems/', (route) => fulfillJson(route, 200, { count: 1, results: [waiterClient] }));
}

// ── Console (onboarding and test set) ──

/** Stub the onboarding steps; each POST answers like the backend for a valid step. */
export async function stubOnboarding(page: Page) {
  await page.route('**/api/console/client-systems/create/', (route) =>
    fulfillJson(route, 201, { id: 7, name: 'ProjectApp', key_id: 'fk_projectapp', secret: 'secreto-que-solo-se-ve-una-vez' }),
  );
  await page.route('**/api/console/issuers/create/', (route) => fulfillJson(route, 201, { id: 3, nit: testIssuer.nit, legal_name: 'ProjectApp' }));
  await page.route('**/api/console/issuers/3/certificate/', (route) =>
    fulfillJson(route, 201, { id: 1, subject: 'CN=ProjectApp', not_after: '2027-10-05T00:00:00Z' }),
  );
  await page.route('**/api/console/issuers/3/software/', (route) => fulfillJson(route, 201, { environment: '2', software_id: 'sw-123', has_test_set: true }));
  await page.route('**/api/console/issuers/3/ranges/', (route) => fulfillJson(route, 201, { id: 5, prefix: 'SETP' }));
}

const readyIssuer = { environment: true, certificate: true, software: true, test_set_id: true, range: true };

export const runningTestSet = {
  id: 9,
  state: 'processing',
  error: '',
  created_at: '2026-10-05T12:00:00Z',
  updated_at: '2026-10-05T12:00:00Z',
  documents: [{ kind: 'invoice', full_number: 'SETP990000000', code: 'cufe-1', status: 'pending', messages: [], file_name: 'fv.xml' }],
  phases: [{ name: 'invoices', zip_key: 'zip-1', errors: [] }],
};

/** Stub the test set of the test issuer: no run yet, starting creates one and checking accepts it. */
export async function stubTestSet(page: Page) {
  await page.route('**/api/console/issuers/3/test-set/', (route) =>
    route.request().method() === 'POST'
      ? fulfillJson(route, 201, runningTestSet)
      : fulfillJson(route, 200, { readiness: readyIssuer, run: null }),
  );
  await page.route('**/api/console/test-sets/9/check/', (route) =>
    fulfillJson(route, 200, {
      ...runningTestSet,
      state: 'accepted',
      documents: runningTestSet.documents.map((document) => ({ ...document, status: 'accepted' })),
    }),
  );
}

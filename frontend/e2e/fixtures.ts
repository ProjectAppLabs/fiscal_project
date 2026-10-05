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

/** Start the test already signed in: token cookies plus a valid `validate_token/`. */
export async function signInWithCookies(context: BrowserContext, page: Page, baseURL: string) {
  await context.addCookies([
    { name: 'access_token', value: FAKE_ACCESS_TOKEN, url: baseURL },
    { name: 'refresh_token', value: FAKE_REFRESH_TOKEN, url: baseURL },
  ]);
  await stubValidToken(page);
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
export async function stubConsoleSummaryFailingOnce(page: Page) {
  let calls = 0;
  await page.route('**/api/console/summary/', (route) => {
    calls += 1;
    return calls === 1 ? fulfillJson(route, 500, { detail: 'Error' }) : fulfillJson(route, 200, consoleSummary);
  });
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

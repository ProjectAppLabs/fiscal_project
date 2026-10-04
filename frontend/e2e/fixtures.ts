/**
 * E2E fixtures and helpers.
 *
 * The backend is stubbed per test with `page.route` for auth responses, so the
 * specs do not depend on seeded users.
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

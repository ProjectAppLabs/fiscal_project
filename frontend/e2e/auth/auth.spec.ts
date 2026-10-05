import { test, expect } from '../test-with-coverage';
import {
  clearSession,
  signInWithCookies,
  stubNoCaptcha,
  stubSendPasscode,
  stubSignInRejected,
  stubSignInSuccess,
  stubValidToken,
  testOperator,
  waitForPageLoad,
} from '../fixtures';
import {
  AUTH_FORGOT_PASSWORD_FORM,
  AUTH_FORGOT_PASSWORD_SEND_CODE,
  AUTH_LOGIN_INVALID,
  AUTH_LOGIN_SUCCESS,
  AUTH_PROTECTED_REDIRECT,
  AUTH_SIGN_IN_FORM,
  AUTH_SIGN_OUT,
} from '../helpers/flow-tags';

test.describe('Authentication', () => {
  test.beforeEach(async ({ context, page }) => {
    await clearSession(context, page);
    await stubNoCaptcha(page);
  });

  test('keeps the operator on sign-in when the form is submitted empty', { tag: [...AUTH_SIGN_IN_FORM, '@outcome:error'] }, async ({ page }) => {
    await page.goto('/sign-in');
    await waitForPageLoad(page);

    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL(/.*sign-in/);
  });

  test('accepts typing in the sign-in fields', { tag: [...AUTH_SIGN_IN_FORM, '@outcome:display'] }, async ({ page }) => {
    await page.goto('/sign-in');
    await waitForPageLoad(page);

    const emailInput = page.getByLabel('Correo electrónico');
    await emailInput.fill(testOperator.email);
    const passwordInput = page.getByLabel('Contraseña');
    await passwordInput.fill(testOperator.password);

    await expect(emailInput).toHaveValue(testOperator.email);
    await expect(passwordInput).toHaveValue(testOperator.password);
  });

  test('shows the backend rejection for invalid credentials', { tag: [...AUTH_LOGIN_INVALID, '@outcome:error'] }, async ({ page }) => {
    // Catches a regression where the sign-in form stops surfacing the
    // backend's rejection message and fails silently instead.
    await stubSignInRejected(page, 'Credenciales inválidas.');
    await page.goto('/sign-in');
    await waitForPageLoad(page);

    await page.getByLabel('Correo electrónico').fill(testOperator.email);
    await page.getByLabel('Contraseña').fill('clave-equivocada');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByText('Credenciales inválidas.')).toBeVisible();
    await expect(page).toHaveURL(/.*sign-in/);
  });

  test('lands on the console after signing in', { tag: [...AUTH_LOGIN_SUCCESS, '@outcome:success'] }, async ({ page }) => {
    await stubSignInSuccess(page);
    await stubValidToken(page);
    await page.goto('/sign-in');
    await waitForPageLoad(page);

    await page.getByLabel('Correo electrónico').fill(testOperator.email);
    await page.getByLabel('Contraseña').fill(testOperator.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await page.waitForURL(/.*dashboard/);
    await expect(page.getByText('Consola de operación')).toBeVisible();
  });

  test('redirects to sign-in when opening the dashboard without a session', { tag: [...AUTH_PROTECTED_REDIRECT, '@outcome:success'] }, async ({ page }) => {
    // quality: allow-no-interaction (no UI link to /dashboard when logged out; the guard redirect on direct navigation is the behavior)
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await expect(page).toHaveURL(/.*sign-in/);
  });

  test('signs the operator out from the header', { tag: [...AUTH_SIGN_OUT, '@outcome:success'] }, async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await page.getByRole('banner').getByRole('button', { name: 'Cerrar sesión' }).click();

    await page.waitForURL(/.*sign-in/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('opens the password recovery form from sign-in', { tag: [...AUTH_FORGOT_PASSWORD_FORM, '@outcome:display'] }, async ({ page }) => {
    await page.goto('/sign-in');
    await waitForPageLoad(page);

    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();

    await page.waitForURL(/.*forgot-password/);
    await expect(page.getByRole('heading', { name: 'Restablecer contraseña' })).toBeVisible();
  });

  test('moves to the code step after requesting a passcode', { tag: [...AUTH_FORGOT_PASSWORD_SEND_CODE, '@outcome:success'] }, async ({ page }) => {
    await stubSendPasscode(page, 200);
    await page.goto('/forgot-password');
    await waitForPageLoad(page);

    await page.getByLabel('Correo electrónico').fill(testOperator.email);
    await page.getByRole('button', { name: 'Enviar código' }).click();

    await expect(page.getByLabel('Código de verificación')).toBeVisible();
    await expect(page.getByText('Te enviamos el código a tu correo.')).toBeVisible();
  });

  test('shows an error when the passcode cannot be sent', { tag: [...AUTH_FORGOT_PASSWORD_SEND_CODE, '@outcome:failure'] }, async ({ page }) => {
    await stubSendPasscode(page, 500, {});
    await page.goto('/forgot-password');
    await waitForPageLoad(page);

    await page.getByLabel('Correo electrónico').fill(testOperator.email);
    await page.getByRole('button', { name: 'Enviar código' }).click();

    await expect(page.getByText('No se pudo enviar el código.')).toBeVisible();
    await expect(page.getByLabel('Código de verificación')).toBeHidden();
  });
});

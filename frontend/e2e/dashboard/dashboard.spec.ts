import { test, expect } from '../test-with-coverage';
import { clearSession, signInWithCookies, waitForPageLoad } from '../fixtures';
import { DASHBOARD_EMPTY_STATE, HOME_REDIRECT } from '../helpers/flow-tags';

test.describe('Console', () => {
  test('shows the Fiscal. console with the empty documents state', { tag: [...DASHBOARD_EMPTY_STATE, '@outcome:display'] }, async ({ context, page, baseURL }) => {
    // quality: allow-no-interaction (the dashboard is a read-only skeleton; rendering it for a signed-in operator is the behavior)
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Fiscal.' })).toBeVisible();
    await expect(page.getByTestId('dashboard-empty-state')).toContainText('Todavía no hay documentos');
  });

  test('sends a visitor without a session from home to sign-in', { tag: [...HOME_REDIRECT, '@outcome:success'] }, async ({ context, page }) => {
    // quality: allow-no-interaction (home is the app entry point; the redirect on direct navigation is the behavior)
    await clearSession(context, page);
    await page.goto('/');
    await waitForPageLoad(page);

    await expect(page).toHaveURL(/.*sign-in/);
  });

  test('sends a signed-in operator from home to the console', { tag: [...HOME_REDIRECT, '@outcome:success'] }, async ({ context, page, baseURL }) => {
    // quality: allow-no-interaction (home is the app entry point; the redirect on direct navigation is the behavior)
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await page.goto('/');
    await waitForPageLoad(page);

    await expect(page).toHaveURL(/.*dashboard/);
  });
});

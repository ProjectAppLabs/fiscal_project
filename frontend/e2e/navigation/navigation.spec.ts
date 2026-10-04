import { test, expect } from '../test-with-coverage';
import { clearSession, waitForPageLoad } from '../fixtures';
import { I18N_LOCALE_SWITCH, NAVIGATION_UNKNOWN_ROUTE } from '../helpers/flow-tags';

test.describe('Navigation', () => {
  test.beforeEach(async ({ context, page }) => {
    await clearSession(context, page);
  });

  test('switches the interface from Spanish to English', { tag: [...I18N_LOCALE_SWITCH, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/sign-in');
    await waitForPageLoad(page);

    await page.getByRole('button', { name: 'Cambiar el idioma a English' }).click();

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('returns a 404 status for an unknown route', { tag: [...NAVIGATION_UNKNOWN_ROUTE, '@outcome:failure'] }, async ({ page }) => {
    // Catches a routing regression (e.g. an accidental catch-all, or a
    // proxy rewrite) that would make unknown URLs resolve as 200 with a
    // blank/broken page, or 500, instead of a clean 404.
    // quality: allow-no-interaction (no UI link to a nonexistent route exists by definition; direct navigation is the only way to reach this behavior)
    const response = await page.goto('/this-route-does-not-exist-e2e');

    expect(response?.status()).toEqual(404);
  });
});

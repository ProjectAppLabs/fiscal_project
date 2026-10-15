import { test, expect } from '../test-with-coverage';
import { clearSession, signInWithCookies, stubApiDocs, stubConsoleSummary, waitForPageLoad } from '../fixtures';
import { CONSOLE_API_DOCS, CONSOLE_API_DOCS_PRIVATE, CONSOLE_API_DOCS_SEARCH } from '../helpers/flow-tags';

test.describe('Console API docs', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await stubConsoleSummary(page);
    await stubApiDocs(page);
  });

  test('switches the examples to production', { tag: [...CONSOLE_API_DOCS, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.getByRole('banner').getByRole('button', { name: 'Tu cuenta' }).click();
    await page.getByRole('menuitem', { name: 'Documentación de la API' }).click();
    await page.getByRole('link', { name: 'Emitir documentos' }).click();

    await page.getByRole('radio', { name: 'Producción' }).click();

    await expect(page.getByRole('article')).toContainText('"prefix": "FE1"');
  });

  test('finds an endpoint from the search', { tag: [...CONSOLE_API_DOCS_SEARCH, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/api-docs/introduccion');
    await waitForPageLoad(page);

    await page.keyboard.press('Control+k');
    await page.getByRole('textbox', { name: 'Qué buscas' }).fill('emitir un documento');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'POST /api/v1/documents/create/' })).toBeVisible();
  });
});

test.describe('Console API docs without a session', () => {
  test('sends visitors to the sign-in', { tag: [...CONSOLE_API_DOCS_PRIVATE, '@outcome:failure'] }, async ({ context, page }) => {
    // quality: allow-no-interaction (the contract is typing the docs address without a session; nothing to click)
    await clearSession(context, page);

    await page.goto('/api-docs/referencia');

    await expect(page).toHaveURL(/\/sign-in/);
  });
});

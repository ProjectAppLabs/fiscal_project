import { readFileSync } from 'fs';

import { test, expect } from '../test-with-coverage';
import { signInWithCookies, stubClientSystems, stubConsoleSummary, waitForPageLoad } from '../fixtures';
import { CONSOLE_FIELD_HELP, CONSOLE_HELP_GUIDES } from '../helpers/flow-tags';

test.describe('Console help', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await stubConsoleSummary(page);
    await stubClientSystems(page);
  });

  test('downloads a guide for Claude in Chrome with the console address', { tag: [...CONSOLE_HELP_GUIDES, '@outcome:success'] }, async ({ page, baseURL }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.getByRole('banner').getByRole('button', { name: 'Tu cuenta' }).click();
    await page.getByRole('menuitem', { name: 'Guías y ayuda' }).click();
    await page.waitForURL(/.*\/help$/);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar .md: Correr el set de pruebas de la DIAN' }).click();
    const file = await (await download).path();

    expect(readFileSync(file, 'utf-8')).toContain(`Consola de Fiscal.: \`${new URL(baseURL ?? 'http://localhost:3000').origin}\``);
  });

  test('explains where a field comes from', { tag: [...CONSOLE_FIELD_HELP, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/onboarding');
    await waitForPageLoad(page);

    await page.getByRole('button', { name: 'Ayuda: URL de avisos (opcional)' }).click();

    await expect(page.getByRole('note')).toContainText('Te la da el equipo técnico del sistema cliente.');
  });
});

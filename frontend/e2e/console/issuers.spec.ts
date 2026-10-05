import { test, expect } from '../test-with-coverage';
import {
  otherIssuerRow,
  signInWithCookies,
  stubConsoleSummary,
  stubContingencyLetter,
  stubIssuerDetail,
  stubIssuerList,
  testIssuerDetail,
  testIssuerRow,
  waitForPageLoad,
} from '../fixtures';
import { CONSOLE_CONTINGENCY_LETTER, CONSOLE_ISSUER_DETAIL, CONSOLE_ISSUERS_LIST } from '../helpers/flow-tags';

test.describe('Console issuers', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await stubConsoleSummary(page);
    await stubIssuerList(page);
    await stubIssuerDetail(page);
    await stubContingencyLetter(page);
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.getByRole('banner').getByRole('link', { name: 'Emisores' }).click();
    await page.waitForURL(/.*\/issuers$/);
  });

  test('lists the issuers with their certificate and alerts', { tag: [...CONSOLE_ISSUERS_LIST, '@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (the operator reaches the list by clicking «Emisores» in beforeEach; reading it is the behavior)
    const table = page.getByRole('table', { name: 'Emisores registrados' });

    await expect(table.getByRole('link', { name: testIssuerRow.legal_name })).toBeVisible();
    await expect(table.getByRole('link', { name: otherIssuerRow.legal_name })).toBeVisible();
    await expect(table).toContainText(`${testIssuerRow.nit}-${testIssuerRow.dv}`);
  });

  test('searches the issuers by name', { tag: [...CONSOLE_ISSUERS_LIST, '@outcome:success'] }, async ({ page }) => {
    await page.getByLabel('Buscar por NIT o nombre').fill('Espiga');
    await page.getByRole('button', { name: 'Buscar' }).click();

    const table = page.getByRole('table', { name: 'Emisores registrados' });
    await expect(table.getByRole('link', { name: otherIssuerRow.legal_name })).toBeVisible();
    await expect(table.getByRole('link', { name: testIssuerRow.legal_name })).toBeHidden();
  });

  test('opens an issuer with its ranges, software and alerts', { tag: [...CONSOLE_ISSUER_DETAIL, '@outcome:display'] }, async ({ page }) => {
    await page.getByRole('link', { name: testIssuerRow.legal_name }).click();

    await page.waitForURL(/.*\/issuers\/3$/);
    await expect(page.getByRole('heading', { level: 1, name: testIssuerDetail.legal_name })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Rangos de numeración del emisor' })).toContainText('95 %');
    await expect(page.getByRole('table', { name: 'Software registrado ante la DIAN' })).toContainText('sw-123');
    await expect(page.getByRole('region', { name: 'Alertas abiertas' })).toContainText('Numeración por agotarse');
  });

  test('downloads the contingency letter for a period', { tag: [...CONSOLE_CONTINGENCY_LETTER, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('link', { name: testIssuerRow.legal_name }).click();
    await page.getByLabel('Desde').fill('2026-10-01');
    await page.getByLabel('Hasta').fill('2026-10-03');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar borrador' }).click(),
    ]);

    expect(download.suggestedFilename()).toBe('carta-contingencia-2026-10-01-2026-10-03.pdf');
  });

  test('explains when the letter period is reversed', { tag: [...CONSOLE_CONTINGENCY_LETTER, '@outcome:error'] }, async ({ page }) => {
    await page.getByRole('link', { name: testIssuerRow.legal_name }).click();
    await page.getByLabel('Desde').fill('2026-10-05');
    await page.getByLabel('Hasta').fill('2026-10-01');

    await page.getByRole('button', { name: 'Descargar borrador' }).click();

    await expect(page.getByRole('region', { name: 'Carta de contingencia a la DIAN' }).getByRole('alert')).toContainText(
      'No se pudo generar la carta. Revisa las fechas.',
    );
  });
});

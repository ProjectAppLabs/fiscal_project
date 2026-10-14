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
import {
  CONSOLE_CONTINGENCY_LETTER,
  CONSOLE_ISSUER_CERTIFICATE_REPLACE,
  CONSOLE_ISSUER_DETAIL,
  CONSOLE_ISSUER_RANGE_ADD,
  CONSOLE_ISSUERS_LIST,
} from '../helpers/flow-tags';

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
    await page.getByRole('tab', { name: 'Numeración' }).click();
    await expect(page.getByRole('table', { name: 'Rangos de numeración del emisor' })).toContainText('95 %');
    await page.getByRole('tab', { name: 'Certificados y software' }).click();
    await expect(page.getByRole('table', { name: 'Software registrado ante la DIAN' })).toContainText('sw-123');
    await page.getByRole('tab', { name: /Resumen/ }).click();
    await expect(page.getByRole('region', { name: 'Alertas abiertas' })).toContainText('Numeración por agotarse');
  });

  test('downloads the contingency letter for a period', { tag: [...CONSOLE_CONTINGENCY_LETTER, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('link', { name: testIssuerRow.legal_name }).click();
    await page.getByRole('tab', { name: 'Contingencia' }).click();
    await page.getByLabel('Desde', { exact: true }).fill('2026-10-01');
    await page.getByLabel('Hasta', { exact: true }).fill('2026-10-03');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar borrador' }).click(),
    ]);

    expect(download.suggestedFilename()).toBe('carta-contingencia-2026-10-01-2026-10-03.pdf');
  });

  test('explains when the letter period is reversed', { tag: [...CONSOLE_CONTINGENCY_LETTER, '@outcome:error'] }, async ({ page }) => {
    await page.getByRole('link', { name: testIssuerRow.legal_name }).click();
    await page.getByRole('tab', { name: 'Contingencia' }).click();
    await page.getByLabel('Desde', { exact: true }).fill('2026-10-05');
    await page.getByLabel('Hasta', { exact: true }).fill('2026-10-01');

    await page.getByRole('button', { name: 'Descargar borrador' }).click();

    await expect(page.getByRole('region', { name: 'Carta de contingencia a la DIAN' }).getByRole('alert')).toContainText(
      'No se pudo generar la carta. Revisa las fechas.',
    );
  });

  test('adds a contingency range from the numbering tab', { tag: [...CONSOLE_ISSUER_RANGE_ADD, '@outcome:success'] }, async ({ page }) => {
    let sent: Record<string, unknown> | null = null;
    await page.route('**/api/console/issuers/3/ranges/', async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 9, prefix: 'PAP' }) });
    });
    await page.getByRole('link', { name: testIssuerRow.legal_name }).click();
    await page.getByRole('tab', { name: 'Numeración' }).click();

    await page.getByRole('button', { name: 'Agregar rango' }).click();
    const dialog = page.getByRole('dialog', { name: 'Agregar rango' });
    await dialog.getByRole('radio', { name: /Contingencia/ }).check();
    await dialog.getByLabel('Número de resolución').fill('18764000009');
    await dialog.getByLabel('Prefijo').fill('pap');
    await dialog.getByLabel('Hasta', { exact: true }).fill('500');
    await dialog.getByLabel('Vigente desde').fill('2026-10-01');
    await dialog.getByLabel('Vigente hasta').fill('2028-10-01');
    await dialog.getByRole('button', { name: 'Guardar rango' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Rango agregado' })).toBeVisible();
    expect(sent).toMatchObject({ kind: 'contingency', prefix: 'PAP', number_to: 500 });
  });

  test('replaces the certificate from its tab', { tag: [...CONSOLE_ISSUER_CERTIFICATE_REPLACE, '@outcome:success'] }, async ({ page }) => {
    await page.route('**/api/console/issuers/3/certificate/', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 2, subject: 'CN=Restaurante de Prueba SAS', not_after: '2028-10-05T05:00:00Z', chain_complete: true }),
      }),
    );
    await page.getByRole('link', { name: testIssuerRow.legal_name }).click();
    await page.getByRole('tab', { name: 'Certificados y software' }).click();

    await page.getByRole('button', { name: 'Reemplazar certificado' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reemplazar certificado' });
    await dialog.getByLabel('Archivo del certificado').setInputFiles({ name: 'nuevo.p12', mimeType: 'application/x-pkcs12', buffer: Buffer.from('p12') });
    await dialog.getByLabel('Contraseña del certificado').fill('clave-del-certificado');
    await dialog.getByRole('button', { name: 'Guardar certificado' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Certificado cargado' })).toBeVisible();
  });
});

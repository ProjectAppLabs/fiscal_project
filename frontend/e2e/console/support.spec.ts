import { test, expect } from '../test-with-coverage';
import {
  signInWithCookies,
  stubAlerts,
  stubConsoleSummary,
  stubContingencies,
  stubDocumentDetail,
  stubDocumentList,
  stubSupport,
  waitForPageLoad,
} from '../fixtures';
import {
  CONSOLE_ALERTS_BULK_RESOLVE,
  CONSOLE_CONTINGENCY_TRANSMIT,
  CONSOLE_DOCUMENT_SUPPORT,
  CONSOLE_DOCUMENTS_SEARCH,
  CONSOLE_HEALTH_DETAIL,
} from '../helpers/flow-tags';

test.describe('Console support', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await stubConsoleSummary(page);
    await stubDocumentList(page);
    await stubDocumentDetail(page);
    await stubContingencies(page);
    await stubAlerts(page);
    await stubSupport(page);
  });

  test('asks the DIAN about a document', { tag: [...CONSOLE_DOCUMENT_SUPPORT, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/documents/7');
    await waitForPageLoad(page);

    await page.getByRole('button', { name: 'Consultar a la DIAN' }).click();

    await expect(page.getByRole('dialog', { name: 'Lo que dice la DIAN' })).toContainText('FAD06: El CUFE no corresponde.');
  });

  test('resends the notice of a document', { tag: [...CONSOLE_DOCUMENT_SUPPORT, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/documents/7');
    await waitForPageLoad(page);

    await page.getByRole('button', { name: 'Reenviar aviso' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Aviso entregado al sistema cliente.' })).toBeVisible();
  });

  test('transmits a DIAN contingency now', { tag: [...CONSOLE_CONTINGENCY_TRANSMIT, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/contingencies');
    await waitForPageLoad(page);

    await page.getByRole('button', { name: 'Transmitir ahora: SETP990000021' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'SETP990000021 pasó al primer lugar de la cola.' })).toBeVisible();
  });

  test('resolves the selected alerts with a note', { tag: [...CONSOLE_ALERTS_BULK_RESOLVE, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/alerts');
    await waitForPageLoad(page);
    await page.getByLabel('Severidad').selectOption('critical');
    await page.getByLabel('Seleccionar las abiertas de esta página').check();
    await page.getByRole('button', { name: 'Resolver seleccionadas' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nota (opcional)').fill('Se revisó con la DIAN');
    await dialog.getByRole('button', { name: 'Resolver seleccionadas' }).click();
    await page.getByLabel('Mostrar también las resueltas').check();

    await expect(page.getByRole('row', { name: /Cola detenida/ })).toContainText('«Se revisó con la DIAN»');
  });

  test('searches a document by its number', { tag: [...CONSOLE_DOCUMENTS_SEARCH, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/documents');
    await waitForPageLoad(page);

    await page.getByLabel('Número o CUFE').fill('SETP990000007');
    await page.getByRole('button', { name: 'Filtrar' }).click();

    await expect(page).toHaveURL(/q=SETP990000007/);
  });

  test('opens the service health from the dashboard', { tag: [...CONSOLE_HEALTH_DETAIL, '@outcome:success'] }, async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await page.getByRole('link', { name: 'Ver salud en detalle' }).click();

    await expect(page.getByRole('link', { name: /Documentos en cola/ })).toHaveAttribute('href', '/documents?state=queued');
  });
});

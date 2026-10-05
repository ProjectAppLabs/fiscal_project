import { test, expect } from '../test-with-coverage';
import {
  dianContingency,
  queueAlert,
  rejectionAlert,
  signInWithCookies,
  stubAlerts,
  stubClientSystems,
  stubConsoleSummary,
  stubContingencies,
  stubDocumentDetail,
  waitForPageLoad,
  waiterClient,
} from '../fixtures';
import { CONSOLE_ALERTS_RESOLVE, CONSOLE_CLIENT_SYSTEMS, CONSOLE_CONTINGENCIES } from '../helpers/flow-tags';

test.describe('Console operations', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await stubConsoleSummary(page);
    await stubContingencies(page);
    await stubAlerts(page);
    await stubClientSystems(page);
    await stubDocumentDetail(page);
    await page.goto('/dashboard');
    await waitForPageLoad(page);
  });

  test('shows the 48-hour clock of an invoice in contingency', { tag: [...CONSOLE_CONTINGENCIES, '@outcome:display'] }, async ({ page }) => {
    await page.getByRole('banner').getByRole('link', { name: 'Contingencias' }).click();

    const table = page.getByRole('table', { name: 'Facturas en contingencia' });
    await expect(table.getByRole('link', { name: dianContingency.full_number })).toBeVisible();
    await expect(table).toContainText('DIAN (tipo 04)');
    await expect(table).toContainText('5,5 h');
  });

  test('resolves an alert from the list', { tag: [...CONSOLE_ALERTS_RESOLVE, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('banner').getByRole('link', { name: 'Alertas' }).click();
    const table = page.getByRole('table', { name: 'Alertas' });
    await expect(table).toContainText(rejectionAlert.message);

    await table.getByRole('button', { name: `Resolver: ${rejectionAlert.message}` }).click();

    await expect(table).not.toContainText(rejectionAlert.message);
    await expect(table).toContainText(queueAlert.message);
  });

  test('shows the resolved alerts on demand', { tag: [...CONSOLE_ALERTS_RESOLVE, '@outcome:display'] }, async ({ page }) => {
    await page.getByRole('banner').getByRole('link', { name: 'Alertas' }).click();
    await page.getByRole('table', { name: 'Alertas' }).getByRole('button', { name: `Resolver: ${rejectionAlert.message}` }).click();

    await page.getByLabel('Mostrar también las resueltas').check();

    await expect(page.getByRole('table', { name: 'Alertas' })).toContainText('Resuelta el');
  });

  test('lists the client systems with their failed notices', { tag: [...CONSOLE_CLIENT_SYSTEMS, '@outcome:display'] }, async ({ page }) => {
    await page.getByRole('banner').getByRole('link', { name: 'Sistemas cliente' }).click();

    const table = page.getByRole('table', { name: 'Sistemas cliente' });
    await expect(table).toContainText(waiterClient.key_id);
    await expect(table).toContainText('0 pendientes · 1 fallidos');
  });
});

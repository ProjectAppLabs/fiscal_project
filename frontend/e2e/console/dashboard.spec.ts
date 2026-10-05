import { test, expect } from '../test-with-coverage';
import {
  signInWithCookies,
  stubConsoleSummary,
  stubConsoleSummaryFailing,
  stubConsoleSummaryFailingUntilRecovered,
  waitForPageLoad,
} from '../fixtures';
import { CONSOLE_DASHBOARD_COUNTERS, CONSOLE_DASHBOARD_HEALTH, CONSOLE_DASHBOARD_RETRY } from '../helpers/flow-tags';

test.describe('Console dashboard', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
  });

  test('shows the documents by state from the console summary', { tag: [...CONSOLE_DASHBOARD_COUNTERS, '@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (the dashboard is the operator's landing page; reading the counters on arrival is the behavior)
    await stubConsoleSummary(page);
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await expect(page.getByRole('group', { name: 'Total' })).toContainText('12');
    await expect(page.getByRole('group', { name: 'Validados' })).toContainText('8');
    await expect(page.getByRole('group', { name: 'Listos para enviar' })).toContainText('2');
  });

  test('shows the latest rejection with its first DIAN error', { tag: [...CONSOLE_DASHBOARD_COUNTERS, '@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (the dashboard is the operator's landing page; reading the latest rejection on arrival is the behavior)
    await stubConsoleSummary(page);
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    const rejection = page.getByRole('region', { name: 'Último rechazo' });
    await expect(rejection).toContainText('SETP990000007');
    await expect(rejection).toContainText('FAD06: El CUFE no corresponde.');
  });

  test('shows the open alerts and the service health', { tag: [...CONSOLE_DASHBOARD_HEALTH, '@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (the dashboard is the operator's landing page; reading alerts and health on arrival is the behavior)
    await stubConsoleSummary(page);
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    const alerts = page.getByRole('region', { name: 'Alertas abiertas' });
    await expect(alerts.getByRole('group', { name: 'Alertas abiertas' })).toContainText('2');
    await expect(alerts).toContainText('1 crítica');
    await expect(page.getByRole('region', { name: 'Salud del servicio' })).toContainText('Todo en orden');
  });

  test('shows an error when the summary cannot be loaded', { tag: [...CONSOLE_DASHBOARD_RETRY, '@outcome:error'] }, async ({ page }) => {
    // Catches a regression where a failed summary leaves the dashboard blank
    // or stuck on loading instead of telling the operator something went wrong.
    // quality: allow-no-interaction (the summary loads on arrival; the failure surfacing without any click is the behavior)
    await stubConsoleSummaryFailing(page);
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await expect(page.getByRole('main').getByRole('alert')).toContainText('No pudimos cargar el tablero.');
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
  });

  test('loads the counters again after a failed summary', { tag: [...CONSOLE_DASHBOARD_RETRY, '@outcome:success'] }, async ({ page }) => {
    // Catches a regression where a failed summary leaves the dashboard stuck
    // on the error with no way to recover short of reloading the page.
    const recover = await stubConsoleSummaryFailingUntilRecovered(page);
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await expect(page.getByRole('main').getByRole('alert')).toContainText('No pudimos cargar el tablero.');
    recover();

    await page.getByRole('button', { name: 'Reintentar' }).click();

    await expect(page.getByRole('group', { name: 'Total' })).toContainText('12');
  });
});

import { test, expect } from '../test-with-coverage';
import { signInWithCookies, stubClientSystemDetail, stubClientSystems, testOperator, waitForPageLoad } from '../fixtures';
import { CONSOLE_CLIENT_ACCESS, CONSOLE_CLIENT_SYSTEM_CONNECT } from '../helpers/flow-tags';

test.describe('Client system page', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    // Rotating a secret is for administrators.
    await page.route('**/api/validate_token/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { ...testOperator, password: undefined, role: 'admin' } }) }),
    );
    await stubClientSystems(page);
    await stubClientSystemDetail(page);
    await page.goto('/client-systems');
    await waitForPageLoad(page);
    await page.getByRole('main').getByRole('link', { name: 'Waiter' }).click();
    await page.waitForURL(/.*\/client-systems\/1$/);
  });

  test('checks the connection with a signed test notice', { tag: [...CONSOLE_CLIENT_SYSTEM_CONNECT, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('button', { name: 'Enviar aviso de prueba' }).click();

    await expect(page.getByText('Respondió HTTP 204.')).toBeVisible();
  });

  test('rotates the secret and shows the new one once', { tag: [...CONSOLE_CLIENT_SYSTEM_CONNECT, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('button', { name: 'Rotar secreto' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rotar secreto' });
    await dialog.getByRole('button', { name: 'Rotar secreto' }).click();

    await expect(dialog.getByText('secreto-nuevo-de-una-vez')).toBeVisible();
  });

  test('resends a failed notice from the log', { tag: [...CONSOLE_CLIENT_SYSTEM_CONNECT, '@outcome:success'] }, async ({ page }) => {
    const notices = page.getByRole('table', { name: 'Avisos' });
    await expect(notices).toContainText('Numeración por agotarse');

    await notices.getByRole('button', { name: 'Reenviar' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Aviso entregado' })).toBeVisible();
  });

  test('registers the IPs allowed for the client system', { tag: [...CONSOLE_CLIENT_ACCESS, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('button', { name: 'Editar acceso' }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar acceso' });
    await dialog.getByLabel('IPs permitidas', { exact: true }).fill('203.0.113.10');
    await dialog.getByRole('button', { name: 'Guardar acceso' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Acceso actualizado' })).toBeVisible();
  });
});

import { test, expect } from '../test-with-coverage';
import { signInWithCookies, waitForPageLoad } from '../fixtures';
import { ACCOUNT_CHANGE_PASSWORD } from '../helpers/flow-tags';

test.describe('Account', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.getByRole('banner').getByRole('button', { name: 'Tu cuenta' }).click();
    await page.getByRole('menuitem', { name: 'Cambiar contraseña' }).click();
    await page.waitForURL(/.*\/account$/);
  });

  test('changes the password with the current one', { tag: [...ACCOUNT_CHANGE_PASSWORD, '@outcome:success'] }, async ({ page }) => {
    await page.route('**/api/update_password/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );

    await page.getByLabel('Contraseña actual', { exact: true }).fill('clave-vieja-1');
    await page.getByLabel('Contraseña nueva', { exact: true }).fill('clave-nueva-12');
    await page.getByLabel('Confirma la contraseña nueva', { exact: true }).fill('clave-nueva-12');
    await page.getByRole('main').getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Contraseña cambiada' })).toBeVisible();
  });

  test('refuses new passwords that do not match', { tag: [...ACCOUNT_CHANGE_PASSWORD, '@outcome:error'] }, async ({ page }) => {
    await page.getByLabel('Contraseña actual', { exact: true }).fill('clave-vieja-1');
    await page.getByLabel('Contraseña nueva', { exact: true }).fill('clave-nueva-12');
    await page.getByLabel('Confirma la contraseña nueva', { exact: true }).fill('otra-clave-12');
    await page.getByRole('main').getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByRole('main').getByRole('alert')).toContainText('Las contraseñas nuevas no coinciden.');
  });
});

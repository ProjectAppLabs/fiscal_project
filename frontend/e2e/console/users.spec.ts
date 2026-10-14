import { test, expect } from '../test-with-coverage';
import { signInWithCookies, stubAdminSession, stubUsers, waitForPageLoad } from '../fixtures';
import { CONSOLE_USERS_MANAGE } from '../helpers/flow-tags';

test.describe('Console users', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await stubAdminSession(page);
    await stubUsers(page);
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.getByRole('banner').getByRole('button', { name: 'Tu cuenta' }).click();
    await page.getByRole('menuitem', { name: 'Usuarios de la consola' }).click();
    await page.waitForURL(/.*\/users$/);
  });

  test('invites an operator by e-mail', { tag: [...CONSOLE_USERS_MANAGE, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('main').getByRole('button', { name: 'Invitar usuario' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invitar usuario' });
    await dialog.getByLabel('Nombre', { exact: true }).fill('Sara');
    await dialog.getByLabel('Correo', { exact: true }).fill('sara@projectapp.co');
    await dialog.getByRole('button', { name: 'Enviar invitación' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Invitación enviada a sara@projectapp.co' })).toBeVisible();
  });

  test('makes an operator administrator after confirming', { tag: [...CONSOLE_USERS_MANAGE, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('row', { name: /luis@projectapp.co/ }).getByRole('button', { name: 'Hacer administrador' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Hacer administrador' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Usuario actualizado' })).toBeVisible();
  });
});

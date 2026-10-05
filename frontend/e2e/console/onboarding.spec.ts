import { test, expect } from '../test-with-coverage';
import {
  signInWithCookies,
  stubClientSystems,
  stubConsoleSummary,
  stubIssuerDetail,
  stubIssuerList,
  stubOnboarding,
  stubTestSet,
  testIssuerRow,
  waitForPageLoad,
} from '../fixtures';
import { CONSOLE_ONBOARDING, CONSOLE_TEST_SET } from '../helpers/flow-tags';

test.describe('Console onboarding', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await stubConsoleSummary(page);
    await stubIssuerList(page);
    await stubIssuerDetail(page);
    await stubClientSystems(page);
    await stubOnboarding(page);
    await stubTestSet(page);
    await page.goto('/issuers');
    await waitForPageLoad(page);
  });

  test('enrols ProjectApp step by step', { tag: [...CONSOLE_ONBOARDING, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('link', { name: 'Inscribir emisor' }).click();

    await page.getByLabel('Nombre del sistema nuevo').fill('ProjectApp');
    await page.getByRole('button', { name: 'Crear sistema cliente' }).click();
    await expect(page.getByText('secreto-que-solo-se-ve-una-vez')).toBeVisible();
    await page.getByRole('button', { name: 'Ya lo guardé' }).click();

    await page.getByLabel('NIT (sin dígito de verificación)').fill('900373115');
    await page.getByLabel('Dígito de verificación', { exact: true }).fill('3');
    await page.getByLabel('Razón social o nombre').fill('ProjectApp');
    await page.getByLabel('Dirección').fill('Calle 10 #43-12');
    await page.getByLabel('Municipio (código DANE de 5 dígitos)').fill('05001');
    await page.getByLabel('Correo para facturación').fill('facturas@projectapp.co');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByLabel('Archivo del certificado').setInputFiles({ name: 'projectapp.p12', mimeType: 'application/x-pkcs12', buffer: Buffer.from('p12') });
    await page.getByLabel('Contraseña del certificado').fill('clave-del-certificado');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('status')).toContainText('Certificado de CN=ProjectApp');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByLabel('Identificador del software').fill('sw-123');
    await page.getByLabel('PIN del software').fill('12345');
    await page.getByLabel('TestSetId').fill('4de36cb4-9973-4ea4-a156-34e909aa24dc');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByLabel('Prefijo')).toHaveValue('SETP');
    await page.getByLabel('Clave técnica').fill('clave-tecnica-del-catalogo');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByRole('link', { name: 'Ir a la ficha del emisor' })).toHaveAttribute('href', '/issuers/3');
  });

  test('runs the DIAN test set from the issuer page', { tag: [...CONSOLE_TEST_SET, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('link', { name: testIssuerRow.legal_name }).click();
    const panel = page.getByRole('region', { name: 'Set de pruebas de la DIAN' });

    await panel.getByRole('button', { name: 'Iniciar set de pruebas' }).click();
    await expect(panel).toContainText('En proceso en la DIAN');
    await panel.getByRole('button', { name: 'Consultar a la DIAN' }).click();

    await expect(panel).toContainText('Aceptado');
    await expect(panel.getByRole('table', { name: 'Documentos del set de pruebas' })).toContainText('SETP990000000');
  });
});

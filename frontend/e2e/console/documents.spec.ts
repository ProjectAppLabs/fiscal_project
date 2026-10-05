import { test, expect } from '../test-with-coverage';
import {
  olderDocument,
  rejectedDocument,
  rejectedDocumentDetail,
  signInWithCookies,
  stubConsoleSummary,
  stubDocumentDetail,
  stubDocumentList,
  unknownIssuerNit,
  validatedDocument,
  waitForPageLoad,
} from '../fixtures';
import {
  CONSOLE_DOCUMENT_DETAIL,
  CONSOLE_DOCUMENT_NOT_FOUND,
  CONSOLE_DOCUMENTS_FILTER,
  CONSOLE_DOCUMENTS_PAGINATION,
} from '../helpers/flow-tags';

test.describe('Console documents', () => {
  test.beforeEach(async ({ context, page, baseURL }) => {
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await stubConsoleSummary(page);
    await stubDocumentList(page);
    await stubDocumentDetail(page);
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.getByRole('banner').getByRole('link', { name: 'Documentos' }).click();
    await page.waitForURL(/.*\/documents$/);
  });

  test('filters the document list by state', { tag: [...CONSOLE_DOCUMENTS_FILTER, '@outcome:success'] }, async ({ page }) => {
    await expect(page.getByRole('link', { name: validatedDocument.full_number })).toBeVisible();

    await page.getByLabel('Estado').selectOption('rejected');
    await page.getByRole('button', { name: 'Filtrar' }).click();

    await expect(page.getByRole('link', { name: validatedDocument.full_number })).toBeHidden();
    await expect(page.getByRole('link', { name: rejectedDocument.full_number })).toBeVisible();
  });

  test('filters the document list by issuer NIT', { tag: [...CONSOLE_DOCUMENTS_FILTER, '@outcome:success'] }, async ({ page }) => {
    await expect(page.getByRole('link', { name: rejectedDocument.full_number })).toBeVisible();

    await page.getByLabel('NIT del emisor').fill(unknownIssuerNit);
    await page.getByRole('button', { name: 'Filtrar' }).click();

    await expect(page.getByText('No hay documentos con esos filtros.')).toBeVisible();
  });

  test('moves to the next page of documents', { tag: [...CONSOLE_DOCUMENTS_PAGINATION, '@outcome:success'] }, async ({ page }) => {
    await expect(page.getByText('Página 1 · 26 documentos')).toBeVisible();

    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('link', { name: olderDocument.full_number })).toBeVisible();
    await expect(page.getByText('Página 2 · 26 documentos')).toBeVisible();
  });

  test('returns to the first page of documents', { tag: [...CONSOLE_DOCUMENTS_PAGINATION, '@outcome:success'] }, async ({ page }) => {
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('link', { name: olderDocument.full_number })).toBeVisible();

    await page.getByRole('button', { name: 'Anterior' }).click();

    await expect(page.getByRole('link', { name: rejectedDocument.full_number })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });

  test('opens a document from the list', { tag: [...CONSOLE_DOCUMENT_DETAIL, '@outcome:display'] }, async ({ page }) => {
    await page.getByRole('link', { name: rejectedDocument.full_number }).click();

    await page.waitForURL(/.*\/documents\/7$/);
    await expect(page.getByRole('heading', { level: 1, name: rejectedDocument.full_number })).toBeVisible();
    await expect(page.getByRole('group', { name: 'CUFE' })).toContainText(rejectedDocumentDetail.cufe);
  });

  test('shows the DIAN errors of the opened document', { tag: [...CONSOLE_DOCUMENT_DETAIL, '@outcome:display'] }, async ({ page }) => {
    await page.getByRole('link', { name: rejectedDocument.full_number }).click();

    await expect(page.getByRole('region', { name: 'Errores de la DIAN' })).toContainText('FAD06: El CUFE no corresponde.');
  });

  test('shows the artifacts of the opened document', { tag: [...CONSOLE_DOCUMENT_DETAIL, '@outcome:display'] }, async ({ page }) => {
    await page.getByRole('link', { name: rejectedDocument.full_number }).click();

    const artifacts = page.getByRole('table', { name: 'Artefactos guardados' });
    await expect(artifacts).toContainText('signed_xml');
    await expect(artifacts).toContainText('0123456789ab…');
  });

  test('shows the event history of the opened document', { tag: [...CONSOLE_DOCUMENT_DETAIL, '@outcome:display'] }, async ({ page }) => {
    await page.getByRole('link', { name: rejectedDocument.full_number }).click();

    const history = page.getByRole('region', { name: 'Historia' });
    await expect(history.getByRole('listitem')).toHaveCount(rejectedDocumentDetail.events.length);
    await expect(history).toContainText('La DIAN rechazó el documento.');
  });
});

test.describe('Console document not found', () => {
  test('shows the not-found message for a missing document', { tag: [...CONSOLE_DOCUMENT_NOT_FOUND, '@outcome:failure'] }, async ({ context, page, baseURL }) => {
    // Catches a regression where a 404 from the backend renders as a generic
    // error or a blank page instead of telling the operator the document is gone.
    // quality: allow-no-interaction (no UI link points to a document that does not exist; opening a stale URL is the behavior)
    await signInWithCookies(context, page, baseURL ?? 'http://localhost:3000');
    await stubDocumentDetail(page);
    await page.goto('/documents/999');
    await waitForPageLoad(page);

    await expect(page.getByRole('heading', { name: 'No encontramos ese documento' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Volver a documentos/ })).toHaveAttribute('href', '/documents');
  });
});

import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DocumentsPage from '../page';
import { buildDocument, buildDocumentPage, httpError } from '../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import { useConsoleStore } from '../../../lib/stores/consoleStore';

jest.mock('../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../../lib/services/http', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockGet = api.get as unknown as jest.Mock;
const initialConsoleState = useConsoleStore.getState();

const FIRST_PAGE = buildDocumentPage({
  count: 30,
  next: 'http://localhost/api/console/documents/?page=2',
  results: [buildDocument()],
});

const SECOND_PAGE = buildDocumentPage({
  count: 30,
  previous: 'http://localhost/api/console/documents/',
  results: [buildDocument({ id: 8, full_number: 'SETP990000008', state: 'validated', kind: 'credit_note' })],
});

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<DocumentsPage />);
}

function findFirstRow() {
  return screen.findByRole('row', { name: /SETP990000007/ });
}

describe('DocumentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The filters live in the URL: start every test without them.
    window.history.replaceState(null, '', '/documents');
    useConsoleStore.setState(initialConsoleState, true);
    mockGet.mockResolvedValue({ data: FIRST_PAGE });
  });

  it('renders nothing when the user has no session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<DocumentsPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('links each document number to its detail page', async () => {
    renderSignedIn();

    expect(await screen.findByRole('link', { name: 'SETP990000007' })).toHaveAttribute('href', '/documents/7');
  });

  it.each([
    ['the document kind', 'Factura'],
    ['the issuer name', 'Restaurante de Prueba SAS'],
    ['the issuer NIT', '900373115'],
    ['the client system', 'Waiter'],
    ['the state label', 'Rechazado'],
  ])('shows %s in the row', async (_field, text) => {
    renderSignedIn();

    const row = await findFirstRow();

    expect(within(row).getByText(text)).toBeInTheDocument();
  });

  it('shows the number of attempts in the row', async () => {
    renderSignedIn();

    const row = await findFirstRow();

    expect(within(row).getAllByRole('cell')[5]).toHaveTextContent('1');
  });

  it('shows the creation date in Colombia time', async () => {
    renderSignedIn();

    const row = await findFirstRow();

    expect(within(row).getAllByRole('cell')[7]).toHaveTextContent(/10:00/);
  });

  it('shows the page number with the document count', async () => {
    renderSignedIn();

    expect(await screen.findByText('Página 1 · 30 documentos')).toBeInTheDocument();
  });

  it('filters the list by state', async () => {
    renderSignedIn();
    await findFirstRow();

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'rejected');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/documents/', { params: { state: 'rejected' } });
  });

  it('opens already filtered from a link with the state', async () => {
    window.history.replaceState(null, '', '/documents?state=rejected');
    renderSignedIn();

    await findFirstRow();

    expect(mockGet).toHaveBeenLastCalledWith('console/documents/', { params: { state: 'rejected' } });
  });

  it('keeps the applied filters in the URL', async () => {
    renderSignedIn();
    await findFirstRow();

    await userEvent.type(screen.getByLabelText('NIT del emisor'), '900373115');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(window.location.search).toBe('?issuer=900373115');
  });

  it('filters the list by issuer NIT', async () => {
    renderSignedIn();
    await findFirstRow();

    await userEvent.type(screen.getByLabelText('NIT del emisor'), '900373115');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/documents/', { params: { issuer: '900373115' } });
  });

  it('searches by number or CUFE', async () => {
    renderSignedIn();
    await findFirstRow();

    await userEvent.type(screen.getByLabelText('Número o CUFE'), ' SETP990000007 ');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/documents/', { params: { q: 'SETP990000007' } });
  });

  it('filters by kind from the extra filters', async () => {
    renderSignedIn();
    await findFirstRow();

    await userEvent.click(screen.getByRole('button', { name: 'Más filtros' }));
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'credit_note');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/documents/', { params: { kind: 'credit_note' } });
  });

  it('filters by the issue dates', async () => {
    renderSignedIn();
    await findFirstRow();

    await userEvent.click(screen.getByRole('button', { name: 'Más filtros' }));
    await userEvent.type(screen.getByLabelText('Emitido desde'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Emitido hasta'), '2026-10-05');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/documents/', { params: { date_from: '2026-10-01', date_to: '2026-10-05' } });
  });

  it('opens the extra filters when the URL brings one', async () => {
    window.history.replaceState(null, '', '/documents?kind=credit_note');
    renderSignedIn();

    await findFirstRow();

    expect(screen.getByRole('button', { name: 'Menos filtros' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('clears every filter at once', async () => {
    window.history.replaceState(null, '', '/documents?state=rejected');
    renderSignedIn();
    await findFirstRow();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/documents/', { params: {} });
  });

  it('exports the filtered documents as CSV', async () => {
    window.history.replaceState(null, '', '/documents?state=rejected');
    renderSignedIn();
    await findFirstRow();
    mockGet.mockResolvedValue({ data: new Blob(['numero']) });
    Object.assign(URL, { createObjectURL: jest.fn(() => 'blob:documents'), revokeObjectURL: jest.fn() });

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/documents/export/', { params: { state: 'rejected' }, responseType: 'blob' });
  });

  it('disables the previous button on the first page', async () => {
    renderSignedIn();
    await findFirstRow();

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });

  it('shows the next page from the next button', async () => {
    renderSignedIn();
    await findFirstRow();
    mockGet.mockResolvedValue({ data: SECOND_PAGE });

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByRole('link', { name: 'SETP990000008' })).toBeInTheDocument();
    expect(mockGet).toHaveBeenLastCalledWith('console/documents/', { params: { page: 2 } });
  });

  it('returns to the first page from the previous button', async () => {
    useConsoleStore.setState({ page: 2 });
    mockGet.mockResolvedValue({ data: SECOND_PAGE });
    renderSignedIn();
    await screen.findByRole('link', { name: 'SETP990000008' });
    mockGet.mockResolvedValue({ data: FIRST_PAGE });

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(await screen.findByText('Página 1 · 30 documentos')).toBeInTheDocument();
  });

  it('disables the next button on the last page', async () => {
    mockGet.mockResolvedValue({ data: SECOND_PAGE });

    renderSignedIn();
    await screen.findByRole('link', { name: 'SETP990000008' });

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('tells the operator when no document matches the filters', async () => {
    mockGet.mockResolvedValue({ data: buildDocumentPage({ count: 0, results: [] }) });

    renderSignedIn();

    expect(await screen.findByText('No hay documentos con esos filtros.')).toBeInTheDocument();
  });

  it('shows an error when the list cannot be loaded', async () => {
    mockGet.mockRejectedValue(httpError(500));

    renderSignedIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los documentos.');
  });

  it('loads the list again from the retry button', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('link', { name: 'SETP990000007' })).toBeInTheDocument();
  });
});

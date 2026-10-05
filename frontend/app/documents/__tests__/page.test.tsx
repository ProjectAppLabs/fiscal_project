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

  it('filters the list by issuer NIT', async () => {
    renderSignedIn();
    await findFirstRow();

    await userEvent.type(screen.getByLabelText('NIT del emisor'), '900373115');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/documents/', { params: { issuer: '900373115' } });
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

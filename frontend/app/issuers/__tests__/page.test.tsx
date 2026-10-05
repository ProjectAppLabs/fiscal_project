import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import IssuersPage, { CertificateExpiry } from '../page';
import { httpError } from '../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { buildIssuer, buildPage } from '../../../lib/__tests__/operationsFactories';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import { useOperationsStore } from '../../../lib/stores/operationsStore';

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
const initialState = useOperationsStore.getState();

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<IssuersPage />);
}

describe('IssuersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOperationsStore.setState(initialState, true);
    mockGet.mockResolvedValue({ data: buildPage([buildIssuer()]) });
  });

  it('renders nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<IssuersPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists the issuers with a link to their detail', async () => {
    renderSignedIn();

    const table = await screen.findByRole('table', { name: 'Emisores registrados' });

    expect(within(table).getByRole('link', { name: 'Restaurante de Prueba SAS' })).toHaveAttribute('href', '/issuers/3');
    expect(within(table).getByText('900373115-3')).toBeInTheDocument();
    expect(within(table).getByText('Habilitación')).toBeInTheDocument();
  });

  it('searches issuers by NIT or name', async () => {
    renderSignedIn();
    await screen.findByRole('table', { name: 'Emisores registrados' });

    await userEvent.type(screen.getByLabelText('Buscar por NIT o nombre'), 'Casa');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/issuers/', { params: { q: 'Casa' } });
  });

  it('says when no issuer matches', async () => {
    mockGet.mockResolvedValue({ data: buildPage([]) });

    renderSignedIn();

    expect(await screen.findByText('No hay emisores con esa búsqueda.')).toBeInTheDocument();
  });

  it('retries after a failed load', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table', { name: 'Emisores registrados' })).toBeInTheDocument();
  });

  it('moves to the next page of issuers', async () => {
    mockGet.mockResolvedValueOnce({ data: buildPage([buildIssuer()], { count: 30, next: '/api/console/issuers/?page=2' }) });
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/issuers/', { params: { page: 2 } });
  });
});

describe('CertificateExpiry', () => {
  it.each([
    [null, 'Sin certificado'],
    ['2020-01-01T00:00:00Z', 'Vencido'],
  ])('shows %s as %s', (expires, text) => {
    renderWithIntl(<CertificateExpiry expires={expires} />);

    expect(screen.getByText(text)).toHaveClass('text-destructive');
  });

  it('counts the days left of a valid certificate', () => {
    const inTenDays = new Date(Date.now() + 10.5 * 86_400_000).toISOString();

    renderWithIntl(<CertificateExpiry expires={inTenDays} />);

    expect(screen.getByText('en 10 días')).toHaveClass('text-destructive');
  });
});

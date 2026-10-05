import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AlertsPage from '../page';
import { httpError } from '../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { buildAlert, buildPage } from '../../../lib/__tests__/operationsFactories';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import { useOperationsStore } from '../../../lib/stores/operationsStore';

jest.mock('../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../../lib/services/http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;
const initialState = useOperationsStore.getState();
const rejection = buildAlert({
  id: 12,
  kind: 'rejection',
  severity: 'critical',
  message: 'La DIAN rechazó SETP990000007.',
  document: { id: 7, full_number: 'SETP990000007' },
});
const stuckQueue = buildAlert({ id: 13, kind: 'queue_stuck', severity: 'critical', message: 'Cola detenida.', issuer: null });

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<AlertsPage />);
}

describe('AlertsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOperationsStore.setState(initialState, true);
    mockGet.mockResolvedValue({ data: buildPage([rejection, stuckQueue]) });
  });

  it('renders nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<AlertsPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists the open alerts with their severity, document and issuer', async () => {
    renderSignedIn();

    const table = await screen.findByRole('table', { name: 'Alertas' });

    expect(within(table).getAllByText('Crítica')).toHaveLength(2);
    expect(within(table).getByRole('link', { name: 'SETP990000007' })).toHaveAttribute('href', '/documents/7');
    expect(within(table).getByRole('link', { name: 'Restaurante de Prueba SAS' })).toHaveAttribute('href', '/issuers/3');
    expect(within(table).getByText('Todo el servicio')).toBeInTheDocument();
  });

  it('resolves an alert and reloads the list', async () => {
    renderSignedIn();
    await screen.findByRole('table', { name: 'Alertas' });
    mockPost.mockResolvedValueOnce({ data: { ...rejection, resolved_at: '2026-10-05T13:00:00Z' } });
    mockGet.mockResolvedValueOnce({ data: buildPage([stuckQueue]) });

    await userEvent.click(screen.getByRole('button', { name: `Resolver: ${rejection.message}` }));

    expect(mockPost).toHaveBeenCalledWith('console/alerts/12/resolve/');
    expect(await screen.findByText('Cola detenida.')).toBeInTheDocument();
    expect(screen.queryByText(rejection.message)).not.toBeInTheDocument();
  });

  it('says when an alert cannot be resolved', async () => {
    renderSignedIn();
    await screen.findByRole('table', { name: 'Alertas' });
    mockPost.mockRejectedValueOnce(httpError(500));

    await userEvent.click(screen.getByRole('button', { name: `Resolver: ${rejection.message}` }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo resolver la alerta.');
  });

  it('includes the resolved alerts on demand', async () => {
    renderSignedIn();
    await screen.findByRole('table', { name: 'Alertas' });
    mockGet.mockResolvedValueOnce({ data: buildPage([buildAlert({ resolved_at: '2026-10-05T13:00:00Z' })]) });

    await userEvent.click(screen.getByLabelText('Mostrar también las resueltas'));

    expect(mockGet).toHaveBeenLastCalledWith('console/alerts/', { params: { state: 'all' } });
    expect(await screen.findByText(/Resuelta el/)).toBeInTheDocument();
  });

  it('says when there are no open alerts', async () => {
    mockGet.mockResolvedValue({ data: buildPage([]) });

    renderSignedIn();

    expect(await screen.findByText('No hay alertas abiertas.')).toBeInTheDocument();
  });

  it('moves to the next page of alerts', async () => {
    mockGet.mockResolvedValueOnce({ data: buildPage([rejection], { count: 30, next: '/api/console/alerts/?page=2&state=open' }) });
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/alerts/', { params: { state: 'open', page: 2 } });
  });

  it('retries after a failed load', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table', { name: 'Alertas' })).toBeInTheDocument();
  });
});

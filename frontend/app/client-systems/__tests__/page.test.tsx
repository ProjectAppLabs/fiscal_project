import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ClientSystemsPage from '../page';
import { httpError } from '../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { buildClientSystem } from '../../../lib/__tests__/operationsFactories';
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
  return renderWithIntl(<ClientSystemsPage />);
}

describe('ClientSystemsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOperationsStore.setState(initialState, true);
    mockGet.mockResolvedValue({ data: { count: 1, results: [buildClientSystem()] } });
  });

  it('renders nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<ClientSystemsPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows each system with its notice health', async () => {
    renderSignedIn();

    const table = await screen.findByRole('table', { name: 'Sistemas cliente' });

    expect(within(table).getByText('Waiter')).toBeInTheDocument();
    expect(within(table).getByText('fk_waiter')).toBeInTheDocument();
    expect(within(table).getByText('0 pendientes · 1 fallidos')).toHaveClass('text-destructive');
  });

  it('flags a system without notice URL, secret or activity', async () => {
    mockGet.mockResolvedValue({ data: { count: 1, results: [buildClientSystem({ webhook_url: '', valid_secrets: 0, active: false })] } });

    renderSignedIn();

    expect(await screen.findByText('Sin URL de avisos')).toHaveClass('text-destructive');
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('says when there are no client systems', async () => {
    mockGet.mockResolvedValue({ data: { count: 0, results: [] } });

    renderSignedIn();

    expect(await screen.findByText('No hay sistemas cliente.')).toBeInTheDocument();
  });

  it('retries after a failed load', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table', { name: 'Sistemas cliente' })).toBeInTheDocument();
  });
});

import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ClientSystemPage from '../page';
import { httpError } from '../../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../../lib/hooks/useRequireAuth';
import { api } from '../../../../lib/services/http';
import { useAuthStore } from '../../../../lib/stores/authStore';

jest.mock('next/navigation', () => ({
  useParams: () => ({ clientId: '1' }),
}));

jest.mock('../../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../../../lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;
const mockPatch = api.patch as unknown as jest.Mock;

const DETAIL = {
  id: 1,
  name: 'Waiter',
  key_id: 'fk_waiter',
  webhook_url: 'https://waiter.test/avisos/',
  active: true,
  created_at: '2026-10-01T05:00:00Z',
  secrets: [{ id: 1, created_at: '2026-10-01T05:00:00Z', expires_at: null, current: true }],
  issuers: [],
  notices: { pending: 0, failed: 1, delivered: 0 },
  last_delivered_at: null,
};
const FAILED = {
  id: 41, event: 'issuer.alert', state: 'failed', attempts: 30, document: null, alert_kind: 'range_low', last_status: 502,
  last_error: 'HTTP 502', next_attempt_at: null, delivered_at: null, created_at: '2026-10-05T10:00:00Z', payload: {},
};

function renderAs(role: 'admin' | 'operator') {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  useAuthStore.setState({ user: { id: 1, email: 'ana@projectapp.co', first_name: 'Ana', last_name: 'Mejía', role, is_staff: true } });
  return renderWithIntl(<ClientSystemPage />);
}

describe('ClientSystemPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({ data: url.includes('deliveries') ? { count: 1, next: null, previous: null, results: [FAILED] } : DETAIL }),
    );
  });

  it('shows the key identifier to configure the client system', async () => {
    renderAs('operator');

    expect(await screen.findByText('fk_waiter')).toBeInTheDocument();
  });

  it('sends a test notice from the connection guide', async () => {
    mockPost.mockResolvedValue({ data: { ...FAILED, id: 42, event: 'ping', state: 'delivered', last_status: 204 } });
    renderAs('operator');

    await userEvent.click(await screen.findByRole('button', { name: 'Enviar aviso de prueba' }));

    expect(mockPost).toHaveBeenCalledWith('console/client-systems/1/ping/', {});
    expect(await screen.findByText('Respondió HTTP 204.')).toBeInTheDocument();
  });

  it('saves a new notice URL', async () => {
    mockPatch.mockResolvedValue({ data: DETAIL });
    renderAs('operator');

    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    await userEvent.clear(screen.getByLabelText('URL de avisos'));
    await userEvent.type(screen.getByLabelText('URL de avisos'), 'https://waiter.test/v2/');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar URL' }));

    expect(mockPatch).toHaveBeenCalledWith('console/client-systems/1/', { webhook_url: 'https://waiter.test/v2/' });
  });

  it('shows a rotated secret once to an administrator', async () => {
    mockPost.mockResolvedValue({ data: { secret: 'secreto-nuevo', grace_hours: 24 } });
    renderAs('admin');

    await userEvent.click(await screen.findByRole('button', { name: 'Rotar secreto' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rotar secreto' }));

    expect(await screen.findByText('secreto-nuevo')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('console/client-systems/1/rotate-secret/', { grace_hours: 24 });
  });

  it('keeps secret rotation away from operators', async () => {
    renderAs('operator');

    await screen.findByText('fk_waiter');

    expect(screen.getByRole('heading', { name: 'Secretos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rotar secreto' })).not.toBeInTheDocument();
  });

  it('opens on the failed notices', async () => {
    renderAs('operator');

    const table = await screen.findByRole('table', { name: 'Avisos' });

    expect(table).toHaveTextContent('Numeración por agotarse');
    expect(mockGet).toHaveBeenCalledWith('console/client-systems/1/deliveries/', { params: { state: 'failed' } });
  });

  it('resends a failed notice', async () => {
    mockPost.mockResolvedValue({ data: { ...FAILED, state: 'delivered' } });
    renderAs('operator');

    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar' }));

    expect(mockPost).toHaveBeenCalledWith('console/deliveries/41/retry/', {});
  });

  it('shows the not-found message for a missing system', async () => {
    mockGet.mockRejectedValue(httpError(404));

    renderAs('operator');

    expect(await screen.findByRole('heading', { name: 'No encontramos ese sistema cliente' })).toBeInTheDocument();
  });
});

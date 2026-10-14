import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import UsersPage from '../page';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import { useAuthStore } from '../../../lib/stores/authStore';

jest.mock('../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../../lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;
const mockPatch = api.patch as unknown as jest.Mock;

const ANA = { id: 1, email: 'ana@projectapp.co', first_name: 'Ana', last_name: 'Mejía', role: 'admin', is_active: true, invited: false, last_login: null, date_joined: '2026-10-01T05:00:00Z' };
const LUIS = { ...ANA, id: 2, email: 'luis@projectapp.co', first_name: 'Luis', last_name: '', role: 'operator', invited: true };

function renderAs(role: 'admin' | 'operator') {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  useAuthStore.setState({ user: { id: 1, email: 'ana@projectapp.co', first_name: 'Ana', last_name: 'Mejía', role, is_staff: true } });
  return renderWithIntl(<UsersPage />);
}

describe('UsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { count: 2, results: [ANA, LUIS] } });
  });

  it('lists who uses the console with their state', async () => {
    renderAs('admin');

    const row = await screen.findByRole('row', { name: /luis@projectapp.co/ });

    expect(row).toHaveTextContent('Invitado');
  });

  it('keeps the list away from operators', () => {
    renderAs('operator');

    expect(screen.getByText('Solo un administrador puede ver y cambiar los usuarios.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Usuarios de la consola' })).not.toBeInTheDocument();
  });

  it('invites a new operator by e-mail', async () => {
    mockPost.mockResolvedValue({ data: { ...LUIS, id: 3, email: 'sara@projectapp.co', invitation_sent: true } });
    renderAs('admin');

    await userEvent.click(await screen.findByRole('button', { name: 'Invitar usuario' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Sara');
    await userEvent.type(within(dialog).getByLabelText('Correo'), 'sara@projectapp.co');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar invitación' }));

    expect(mockPost).toHaveBeenCalledWith('console/users/', { email: 'sara@projectapp.co', first_name: 'Sara', last_name: '', role: 'operator' });
  });

  it('makes an operator administrator after confirming', async () => {
    mockPatch.mockResolvedValue({ data: { ...LUIS, role: 'admin' } });
    renderAs('admin');

    await userEvent.click(await screen.findByRole('button', { name: 'Hacer administrador' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hacer administrador' }));

    expect(mockPatch).toHaveBeenCalledWith('console/users/2/', { role: 'admin' });
  });

  it('resends a pending invitation', async () => {
    mockPost.mockResolvedValue({ data: { ...LUIS, invitation_sent: true } });
    renderAs('admin');

    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar invitación' }));

    expect(mockPost).toHaveBeenCalledWith('console/users/2/resend-invitation/', {});
  });

  it('offers no actions on the own account', async () => {
    renderAs('admin');

    const row = await screen.findByRole('row', { name: /ana@projectapp.co/ });

    expect(row).toHaveTextContent('(tú)');
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });
});

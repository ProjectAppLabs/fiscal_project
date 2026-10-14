import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AccountPage from '../page';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import { useAuthStore } from '../../../lib/stores/authStore';

jest.mock('../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../../lib/services/http', () => ({
  api: { post: jest.fn() },
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  useAuthStore.setState({ user: { id: 1, email: 'ana@projectapp.co', first_name: 'Ana', last_name: 'Mejía', role: 'admin', is_staff: true } });
  return renderWithIntl(<AccountPage />);
}

async function fillPasswords(current: string, next: string, confirm: string) {
  await userEvent.type(screen.getByLabelText('Contraseña actual'), current);
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), next);
  await userEvent.type(screen.getByLabelText('Confirma la contraseña nueva'), confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
}

describe('AccountPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the role of the signed-in operator', () => {
    renderSignedIn();

    expect(screen.getByRole('group', { name: 'Rol' })).toHaveTextContent('Administrador');
  });

  it('sends the current and the new password', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderSignedIn();

    await fillPasswords('vieja-123', 'nueva-12345', 'nueva-12345');

    expect(mockPost).toHaveBeenCalledWith('update_password/', { current_password: 'vieja-123', new_password: 'nueva-12345' });
  });

  it('refuses new passwords that do not match', async () => {
    renderSignedIn();

    await fillPasswords('vieja-123', 'nueva-12345', 'otra-12345');

    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas nuevas no coinciden.');
  });

  it('refuses a new password shorter than 8 characters', async () => {
    renderSignedIn();

    await fillPasswords('vieja-123', 'corta', 'corta');

    expect(screen.getByRole('alert')).toHaveTextContent('La contraseña nueva debe tener al menos 8 caracteres.');
  });

  it('shows the message of the backend when the current password is wrong', async () => {
    mockPost.mockRejectedValue({ response: { data: { error: 'La contraseña actual no es correcta.' } } });
    renderSignedIn();

    await fillPasswords('mala-1234', 'nueva-12345', 'nueva-12345');

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta.');
  });
});

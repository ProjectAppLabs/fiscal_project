import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Footer from '../Footer';
import Header from '../Header';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useAuthStore } from '../../../lib/stores/authStore';

jest.mock('../../../lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

type AuthState = { isAuthenticated: boolean; signOut: jest.Mock };

const renderHeader = (authState: AuthState) => {
  mockUseAuthStore.mockImplementation((selector: (state: AuthState) => unknown) => selector(authState));
  return renderWithIntl(<Header />);
};

describe('Footer', () => {
  it('shows the Fiscal. brand', () => {
    renderWithIntl(<Footer />);

    expect(screen.getByRole('contentinfo')).toHaveTextContent('Fiscal.');
  });
});

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('links the Fiscal. wordmark to the home page', () => {
    renderHeader({ isAuthenticated: false, signOut: jest.fn() });

    expect(screen.getByRole('link', { name: 'Fiscal.' })).toHaveAttribute('href', '/');
  });

  it('offers the sign-in link to visitors without a session', () => {
    renderHeader({ isAuthenticated: false, signOut: jest.fn() });

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in');
  });

  it.each(['Tablero', 'Documentos'])('hides the %s link from visitors without a session', (name) => {
    renderHeader({ isAuthenticated: false, signOut: jest.fn() });

    expect(screen.getByRole('link', { name: 'Fiscal.' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
  });

  it.each([
    ['Tablero', '/dashboard'],
    ['Documentos', '/documents'],
  ])('links signed-in users to the %s page at %s', (name, href) => {
    renderHeader({ isAuthenticated: true, signOut: jest.fn() });

    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  });

  it('signs the user out from the header button', async () => {
    const signOut = jest.fn();
    renderHeader({ isAuthenticated: true, signOut });

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

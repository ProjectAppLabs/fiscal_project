import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Footer from '../Footer';
import Header from '../Header';
import { buildSummary } from '../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useAuthStore } from '../../../lib/stores/authStore';
import { useConsoleStore } from '../../../lib/stores/consoleStore';

jest.mock('../../../lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockPathname = jest.fn(() => '/dashboard');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
  usePathname: () => mockPathname(),
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

type AuthState = { isAuthenticated: boolean; signOut: jest.Mock; user: { first_name: string; last_name: string; email: string; role: string } | null };

const ANA = { first_name: 'Ana', last_name: 'Mejía', email: 'ana@projectapp.co', role: 'operator' };

const renderHeader = (authState: Partial<AuthState>) => {
  const state: AuthState = { isAuthenticated: false, signOut: jest.fn(), user: null, ...authState };
  mockUseAuthStore.mockImplementation((selector: (current: AuthState) => unknown) => selector(state));
  return renderWithIntl(<Header />);
};

const setNarrowScreen = (narrow: boolean) => {
  (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
    matches: narrow,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
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
    mockPathname.mockReturnValue('/dashboard');
    setNarrowScreen(false);
    useConsoleStore.setState({ summary: buildSummary({ alerts: { total: 3, critical: 1 } }), summaryStatus: 'ready' });
  });

  it('links the Fiscal. wordmark to the home page', () => {
    renderHeader({ isAuthenticated: false });

    expect(screen.getByRole('link', { name: 'Fiscal.' })).toHaveAttribute('href', '/');
  });

  it('offers the sign-in link to visitors without a session', () => {
    renderHeader({ isAuthenticated: false });

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in');
  });

  it.each(['Tablero', 'Documentos', 'Emisores', 'Contingencias', 'Alertas', 'Sistemas cliente'])('hides the %s link from visitors without a session', (name) => {
    renderHeader({ isAuthenticated: false });

    expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
  });

  it.each([
    ['Tablero', '/dashboard'],
    ['Documentos', '/documents'],
    ['Emisores', '/issuers'],
    ['Contingencias', '/contingencies'],
    ['Alertas', '/alerts'],
    ['Sistemas cliente', '/client-systems'],
  ])('links signed-in users to the %s page at %s', (name, href) => {
    renderHeader({ isAuthenticated: true, user: ANA });

    expect(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', { name })).toHaveAttribute('href', href);
  });

  it('marks the page the operator is on', () => {
    mockPathname.mockReturnValue('/issuers/3');
    renderHeader({ isAuthenticated: true, user: ANA });

    expect(screen.getByRole('link', { name: 'Emisores' })).toHaveAttribute('aria-current', 'page');
  });

  it('moves the pill to a clicked link before its page shows', async () => {
    const left = jest.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
      return this.textContent?.startsWith('Alertas') ? 500 : 0;
    });
    renderHeader({ isAuthenticated: true, user: ANA });
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });

    await userEvent.click(within(nav).getByRole('link', { name: 'Alertas' }));

    expect(within(nav).getByTestId('nav-pill').style.transform).toBe('translate(500px, 0px)');
    left.mockRestore();
  });

  it('keeps the shown page as current while the clicked one loads', async () => {
    renderHeader({ isAuthenticated: true, user: ANA });

    await userEvent.click(screen.getByRole('link', { name: 'Alertas' }));

    expect(screen.getByRole('link', { name: 'Tablero' })).toHaveAttribute('aria-current', 'page');
  });

  it('counts the open alerts next to Alertas', () => {
    renderHeader({ isAuthenticated: true, user: ANA });

    expect(screen.getByRole('link', { name: 'Alertas' })).toHaveAccessibleDescription('3 abiertas');
  });

  it('offers the enrolment of a new issuer', () => {
    renderHeader({ isAuthenticated: true, user: ANA });

    expect(screen.getByRole('link', { name: 'Inscribir emisor' })).toHaveAttribute('href', '/onboarding');
  });

  it('shows who is signed in', async () => {
    renderHeader({ isAuthenticated: true, user: ANA });

    await userEvent.click(screen.getByRole('button', { name: 'Tu cuenta' }));

    expect(screen.getByRole('menu')).toHaveTextContent('ana@projectapp.co · Operador');
  });

  it('signs the user out from the account menu', async () => {
    const signOut = jest.fn();
    renderHeader({ isAuthenticated: true, user: ANA, signOut });

    await userEvent.click(screen.getByRole('button', { name: 'Tu cuenta' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('stays out of the sign-in screen', () => {
    mockPathname.mockReturnValue('/sign-in');
    renderHeader({ isAuthenticated: false });

    // quality: allow-negation-only (the sign-in screen draws its own header-less layout)
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('moves the menu to a bottom bar on narrow screens', () => {
    setNarrowScreen(true);
    renderHeader({ isAuthenticated: true, user: ANA });

    expect(screen.getByRole('button', { name: 'Más' })).toBeInTheDocument();
  });

  it('keeps Contingencias under «Más» on narrow screens', async () => {
    setNarrowScreen(true);
    renderHeader({ isAuthenticated: true, user: ANA });

    await userEvent.click(screen.getByRole('button', { name: 'Más' }));

    expect(screen.getByRole('link', { name: 'Contingencias' })).toHaveAttribute('href', '/contingencies');
  });
});

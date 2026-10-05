import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import SignInPage from '../page';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { api } from '../../../lib/services/http';
import { useAuthStore } from '../../../lib/stores/authStore';

jest.mock('react-google-recaptcha', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const MockRecaptcha = React.forwardRef((_props: unknown, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ reset: () => {} }));
    return <div data-testid="mock-recaptcha" />;
  });
  MockRecaptcha.displayName = 'MockRecaptcha';
  return MockRecaptcha;
});

jest.mock('../../../lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../../../lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockUseRouter = useRouter as unknown as jest.Mock;
const mockApiGet = api.get as unknown as jest.Mock;

const setAuthStoreState = (state: { signIn: jest.Mock }) => {
  mockUseAuthStore.mockImplementation((selector?: (store: typeof state) => unknown) =>
    selector ? selector(state) : state
  );
};

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Correo electrónico'), 'operadora@example.com');
  await user.type(screen.getByLabelText('Contraseña'), 'clave-segura-123');
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
};

describe('SignInPage', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockRejectedValue(new Error('no site key'));
    user = userEvent.setup();
  });

  it('redirects to the dashboard after a successful sign in', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    const replace = jest.fn();
    setAuthStoreState({ signIn });
    mockUseRouter.mockReturnValue({ replace });
    renderWithIntl(<SignInPage />);

    await fillAndSubmit(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('sends the typed credentials to the auth store', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    setAuthStoreState({ signIn });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });
    renderWithIntl(<SignInPage />);

    await fillAndSubmit(user);

    expect(signIn).toHaveBeenCalledWith({
      email: 'operadora@example.com',
      password: 'clave-segura-123',
      captcha_token: undefined,
    });
  });

  it('shows the backend error message when sign in fails', async () => {
    const signIn = jest.fn().mockRejectedValue({ response: { data: { error: 'Cuenta bloqueada' } } });
    setAuthStoreState({ signIn });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });
    renderWithIntl(<SignInPage />);

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Cuenta bloqueada');
  });

  it('shows the default error when the failure has no backend message', async () => {
    const signIn = jest.fn().mockRejectedValue(new Error('network down'));
    setAuthStoreState({ signIn });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });
    renderWithIntl(<SignInPage />);

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas.');
  });

  it('renders the reCAPTCHA widget when the backend returns a site key', async () => {
    mockApiGet.mockResolvedValue({ data: { site_key: 'site-key' } });
    setAuthStoreState({ signIn: jest.fn() });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<SignInPage />);

    expect(await screen.findByTestId('mock-recaptcha')).toBeInTheDocument();
  });

  it('blocks submission until the reCAPTCHA is solved', async () => {
    mockApiGet.mockResolvedValue({ data: { site_key: 'site-key' } });
    const signIn = jest.fn();
    setAuthStoreState({ signIn });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });
    renderWithIntl(<SignInPage />);
    await screen.findByTestId('mock-recaptcha');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Completa la verificación de reCAPTCHA.');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('links to the password recovery page', () => {
    setAuthStoreState({ signIn: jest.fn() });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<SignInPage />);

    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute('href', '/forgot-password');
  });
});

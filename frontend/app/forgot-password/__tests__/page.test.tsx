import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import ForgotPasswordPage from '../page';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useAuthStore } from '../../../lib/stores/authStore';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../../../lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockUseRouter = useRouter as unknown as jest.Mock;

const setAuthStoreState = (state: any) => {
  mockUseAuthStore.mockImplementation((selector?: (store: any) => unknown) =>
    selector ? selector(state) : state
  );
};

const submitEmail = () => {
  fireEvent.change(screen.getByPlaceholderText('Correo electrónico'), { target: { value: 'user@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
};

const advanceToCodeStep = async () => {
  submitEmail();
  await screen.findByPlaceholderText('000000');
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends reset code and moves to code step', async () => {
    const sendPasswordResetCode = jest.fn().mockResolvedValue(undefined);
    setAuthStoreState({ sendPasswordResetCode, resetPassword: jest.fn() });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<ForgotPasswordPage />);

    await advanceToCodeStep();

    await waitFor(() => {
      expect(sendPasswordResetCode).toHaveBeenCalledWith('user@example.com');
    });

    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    expect(screen.getByText('Te enviamos el código a tu correo.')).toBeInTheDocument();
  });

  it('shows error when sending code fails', async () => {
    const sendPasswordResetCode = jest
      .fn()
      .mockRejectedValue({ response: { data: { error: 'El servidor de correo no responde' } } });
    setAuthStoreState({ sendPasswordResetCode, resetPassword: jest.fn() });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<ForgotPasswordPage />);

    submitEmail();

    expect(await screen.findByText('El servidor de correo no responde')).toBeInTheDocument();
  });

  it('shows default error when sending code fails without response', async () => {
    const sendPasswordResetCode = jest.fn().mockRejectedValue(new Error('boom'));
    setAuthStoreState({ sendPasswordResetCode, resetPassword: jest.fn() });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<ForgotPasswordPage />);

    submitEmail();

    expect(await screen.findByText('No se pudo enviar el código.')).toBeInTheDocument();
  });

  it('validates password mismatch', async () => {
    const sendPasswordResetCode = jest.fn().mockResolvedValue(undefined);
    const resetPassword = jest.fn();
    setAuthStoreState({ sendPasswordResetCode, resetPassword });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<ForgotPasswordPage />);

    await advanceToCodeStep();

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirma la nueva contraseña'), { target: { value: 'password456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    // Bug this catches: a mismatch-validation regression that clears/loses the
    // already-verified 6-digit code, forcing the user to re-request one.
    expect(screen.getByPlaceholderText('000000')).toHaveValue('123456');
  });

  it('validates password length', async () => {
    const sendPasswordResetCode = jest.fn().mockResolvedValue(undefined);
    const resetPassword = jest.fn();
    setAuthStoreState({ sendPasswordResetCode, resetPassword });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<ForgotPasswordPage />);

    await advanceToCodeStep();

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'short' } });
    fireEvent.change(screen.getByPlaceholderText('Confirma la nueva contraseña'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    expect(await screen.findByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument();
    // Bug this catches: a length-validation regression that clears/loses the
    // already-verified 6-digit code, forcing the user to re-request one.
    expect(screen.getByPlaceholderText('000000')).toHaveValue('123456');
  });

  it('resets password and redirects on success', async () => {
    const sendPasswordResetCode = jest.fn().mockResolvedValue(undefined);
    const resetPassword = jest.fn().mockResolvedValue(undefined);
    const replace = jest.fn();

    setAuthStoreState({ sendPasswordResetCode, resetPassword });
    mockUseRouter.mockReturnValue({ replace });

    renderWithIntl(<ForgotPasswordPage />);

    await advanceToCodeStep();

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirma la nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        code: '123456',
        new_password: 'password123',
      });
    });

    expect(screen.getByText('Contraseña restablecida. Redirigiendo…')).toBeInTheDocument();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/sign-in');
    }, { timeout: 3000 });
  });

  it('shows error when reset fails', async () => {
    const sendPasswordResetCode = jest.fn().mockResolvedValue(undefined);
    const resetPassword = jest
      .fn()
      .mockRejectedValue({ response: { data: { error: 'El código expiró' } } });
    setAuthStoreState({ sendPasswordResetCode, resetPassword });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<ForgotPasswordPage />);

    await advanceToCodeStep();

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirma la nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    expect(await screen.findByText('El código expiró')).toBeInTheDocument();
  });

  it('shows default error when reset fails without response', async () => {
    const sendPasswordResetCode = jest.fn().mockResolvedValue(undefined);
    const resetPassword = jest.fn().mockRejectedValue(new Error('boom'));
    setAuthStoreState({ sendPasswordResetCode, resetPassword });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<ForgotPasswordPage />);

    await advanceToCodeStep();

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirma la nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    expect(await screen.findByText('No se pudo restablecer la contraseña.')).toBeInTheDocument();
  });

  it('allows returning to email step', async () => {
    const sendPasswordResetCode = jest.fn().mockResolvedValue(undefined);
    setAuthStoreState({ sendPasswordResetCode, resetPassword: jest.fn() });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });

    renderWithIntl(<ForgotPasswordPage />);

    await advanceToCodeStep();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al correo' }));

    expect(screen.getByPlaceholderText('Correo electrónico')).toBeInTheDocument();
  });
});

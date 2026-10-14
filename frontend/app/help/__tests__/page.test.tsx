import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';

import HelpPage from '../page';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';

jest.mock('../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;

describe('HelpPage', () => {
  beforeEach(() => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  });

  it('renders nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<HelpPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('groups the guides for the DIAN portals', () => {
    renderWithIntl(<HelpPage />);

    const dian = screen.getByRole('region', { name: 'En los portales de la DIAN' });

    expect(within(dian).getAllByRole('button', { name: /^Copiar guía/ })).toHaveLength(3);
  });

  it('groups the guides for the console', () => {
    renderWithIntl(<HelpPage />);

    const fiscal = screen.getByRole('region', { name: 'En Fiscal.' });

    expect(within(fiscal).getAllByRole('button', { name: /^Copiar guía/ })).toHaveLength(5);
  });

  it('says which data never goes to Claude', () => {
    renderWithIntl(<HelpPage />);

    expect(screen.getByText(/El PIN del software, la clave técnica, la contraseña del certificado/)).toBeInTheDocument();
  });
});

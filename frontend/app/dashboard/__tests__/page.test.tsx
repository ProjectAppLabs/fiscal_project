import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen } from '@testing-library/react';

import DashboardPage from '../page';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';

jest.mock('../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when the user has no session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<DashboardPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the Fiscal. wordmark as the page heading', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });

    renderWithIntl(<DashboardPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Fiscal.' })).toBeInTheDocument();
  });

  it('describes the page as the operations console', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });

    renderWithIntl(<DashboardPage />);

    expect(screen.getByText('Consola de operación')).toBeInTheDocument();
  });

  it('shows the empty state while there are no documents', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });

    renderWithIntl(<DashboardPage />);

    expect(screen.getByTestId('dashboard-empty-state')).toHaveTextContent('Todavía no hay documentos');
  });

  it('renders the English copy when the locale is en', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });

    renderWithIntl(<DashboardPage />, { locale: 'en' });

    expect(screen.getByRole('heading', { level: 2, name: 'There are no documents yet' })).toBeInTheDocument();
  });
});

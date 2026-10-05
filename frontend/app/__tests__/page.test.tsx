import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import HomePage from '../page';
import { renderWithIntl } from '../../lib/__tests__/intl';
import { getAccessToken } from '../../lib/services/tokens';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../../lib/services/tokens', () => ({
  getAccessToken: jest.fn(),
}));

const mockUseRouter = useRouter as unknown as jest.Mock;
const mockGetAccessToken = getAccessToken as unknown as jest.Mock;

describe('HomePage', () => {
  let replace: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    replace = jest.fn();
    mockUseRouter.mockReturnValue({ replace });
  });

  it('redirects to the dashboard when there is a session', () => {
    mockGetAccessToken.mockReturnValue('access-token');

    renderWithIntl(<HomePage />);

    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects to sign-in when there is no session', () => {
    mockGetAccessToken.mockReturnValue(null);

    renderWithIntl(<HomePage />);

    expect(replace).toHaveBeenCalledWith('/sign-in');
  });

  it('shows a redirecting status while the navigation happens', () => {
    mockGetAccessToken.mockReturnValue(null);

    renderWithIntl(<HomePage />);

    expect(screen.getByRole('status')).toHaveTextContent('Redirigiendo…');
  });
});

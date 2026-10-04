import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import Providers from '../providers';

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/services/tokens', () => ({
  getAccessToken: jest.fn(() => null),
}));

const { useAuthStore } = jest.requireMock('@/lib/stores/authStore') as {
  useAuthStore: jest.Mock;
};
const { getAccessToken } = jest.requireMock('@/lib/services/tokens') as {
  getAccessToken: jest.Mock;
};

const mockRestoreUser = (restoreUser: jest.Mock) => {
  useAuthStore.mockImplementation((selector?: (state: { restoreUser: jest.Mock }) => unknown) => {
    const state = { restoreUser };
    return selector ? selector(state) : state;
  });
};

describe('Providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAccessToken.mockReturnValue(null);
  });

  it('renders its children', () => {
    mockRestoreUser(jest.fn());

    render(
      <Providers>
        <span data-testid="child">content</span>
      </Providers>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('restores the user when a token is already present', () => {
    const restoreUser = jest.fn();
    mockRestoreUser(restoreUser);
    getAccessToken.mockReturnValue('access');

    render(
      <Providers>
        <span>content</span>
      </Providers>
    );

    expect(restoreUser).toHaveBeenCalledTimes(1);
  });

  it('skips restoring the user when there is no token', () => {
    // quality: allow-mock-only (the auth store is mocked here; skipping the validate_token round trip is the contract)
    const restoreUser = jest.fn();
    mockRestoreUser(restoreUser);

    render(
      <Providers>
        <span>content</span>
      </Providers>
    );

    expect(screen.getByText('content')).toBeInTheDocument();
    expect(restoreUser).not.toHaveBeenCalled();
  });
});

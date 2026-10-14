import { describe, it, expect } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ErrorPage from '../error';
import NotFound from '../not-found';
import { renderWithIntl } from '../../lib/__tests__/intl';

describe('NotFound', () => {
  it('leads back to the dashboard', () => {
    renderWithIntl(<NotFound />);

    expect(screen.getByRole('link', { name: 'Ir al tablero' })).toHaveAttribute('href', '/dashboard');
  });
});

describe('ErrorPage', () => {
  it('renders the page again from «Reintentar»', async () => {
    const retry = jest.fn();
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithIntl(<ErrorPage error={new Error('boom')} retry={retry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(retry).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});

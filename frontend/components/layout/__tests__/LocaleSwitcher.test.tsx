import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cookies from 'js-cookie';

import { LocaleSwitcher } from '../LocaleSwitcher';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useLocaleStore } from '../../../lib/stores/localeStore';

const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Cookies.remove('NEXT_LOCALE');
    useLocaleStore.setState({ locale: 'es' });
  });

  it('offers English while the page is in Spanish', () => {
    renderWithIntl(<LocaleSwitcher />);

    expect(screen.getByRole('button', { name: 'Cambiar el idioma a English' })).toBeInTheDocument();
  });

  it('offers Spanish while the page is in English', () => {
    renderWithIntl(<LocaleSwitcher />, { locale: 'en' });

    expect(screen.getByRole('button', { name: 'Switch language to Español' })).toBeInTheDocument();
  });

  it('stores the chosen locale in the next-intl cookie', async () => {
    renderWithIntl(<LocaleSwitcher />);

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar el idioma a English' }));

    expect(Cookies.get('NEXT_LOCALE')).toBe('en');
  });

  it('refreshes the route so the server renders the new locale', async () => {
    renderWithIntl(<LocaleSwitcher />);

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar el idioma a English' }));

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});

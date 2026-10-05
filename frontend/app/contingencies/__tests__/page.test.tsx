import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ContingenciesPage, { HoursLeft } from '../page';
import { httpError } from '../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { buildContingency } from '../../../lib/__tests__/operationsFactories';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import { useOperationsStore } from '../../../lib/stores/operationsStore';

jest.mock('../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../../lib/services/http', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockGet = api.get as unknown as jest.Mock;
const initialState = useOperationsStore.getState();

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<ContingenciesPage />);
}

describe('ContingenciesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOperationsStore.setState(initialState, true);
    mockGet.mockResolvedValue({
      data: { count: 2, results: [buildContingency(), buildContingency({ id: 22, full_number: 'CONT7', contingency: 'issuer', invoice_type: '' })] },
    });
  });

  it('renders nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<ContingenciesPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists the invoices with their kind of contingency and link', async () => {
    renderSignedIn();

    const table = await screen.findByRole('table', { name: 'Facturas en contingencia' });

    expect(within(table).getByRole('link', { name: 'SETP990000021' })).toHaveAttribute('href', '/documents/21');
    expect(within(table).getByText('DIAN (tipo 04)')).toBeInTheDocument();
    expect(within(table).getByText('Del emisor (tipo 03)')).toBeInTheDocument();
  });

  it('says when nothing is in contingency', async () => {
    mockGet.mockResolvedValue({ data: { count: 0, results: [] } });

    renderSignedIn();

    expect(await screen.findByText('No hay facturas en contingencia.')).toBeInTheDocument();
  });

  it('retries after a failed load', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table', { name: 'Facturas en contingencia' })).toBeInTheDocument();
  });
});

describe('HoursLeft', () => {
  it.each([
    [18, '18 h', false],
    [5.5, '5,5 h', true],
    [-2, 'Vencido hace 2 h', true],
  ])('shows %s hours as %s (urgent: %s)', (hours, text, urgent) => {
    renderWithIntl(<HoursLeft hours={hours} />);

    const label = screen.getByText(text);
    expect(label.classList.contains('text-destructive')).toBe(urgent);
  });
});

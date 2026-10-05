import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DashboardPage from '../page';
import { buildEmptySummary, buildHealth, buildSummary, httpError } from '../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import { useConsoleStore } from '../../../lib/stores/consoleStore';

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
const initialConsoleState = useConsoleStore.getState();

function renderSignedIn(options: { locale?: 'es' | 'en' } = {}) {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<DashboardPage />, options);
}

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConsoleStore.setState(initialConsoleState, true);
    mockGet.mockResolvedValue({ data: buildSummary() });
  });

  it('renders nothing when the user has no session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<DashboardPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the Fiscal. wordmark as the page heading', async () => {
    renderSignedIn();

    expect(screen.getByRole('heading', { level: 1, name: 'Fiscal.' })).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Total' })).toBeInTheDocument();
  });

  it('requests the console summary for a signed-in operator', async () => {
    renderSignedIn();

    await screen.findByRole('group', { name: 'Total' });

    expect(mockGet).toHaveBeenCalledWith('console/summary/');
  });

  it('shows the total number of documents', async () => {
    renderSignedIn();

    expect(await screen.findByRole('group', { name: 'Total' })).toHaveTextContent('12');
  });

  it.each([
    ['En cola', '2'],
    ['Transmitiendo', '0'],
    ['Validados', '8'],
    ['Rechazados', '1'],
    ['Contingencia DIAN', '1'],
    ['Contingencia del emisor', '0'],
  ])('shows the %s counter as %s', async (label, value) => {
    renderSignedIn();

    expect(await screen.findByRole('group', { name: label })).toHaveTextContent(value);
  });

  it('shows the number of issuers', async () => {
    renderSignedIn();

    expect(await screen.findByRole('group', { name: 'Emisores' })).toHaveTextContent('3');
  });

  it('shows the number of client systems', async () => {
    renderSignedIn();

    expect(await screen.findByRole('group', { name: 'Sistemas cliente' })).toHaveTextContent('4');
  });

  it('shows how many queued documents are ready to send', async () => {
    renderSignedIn();

    expect(await screen.findByRole('group', { name: 'Listos para enviar' })).toHaveTextContent('5');
  });

  it('shows the oldest queued time in Colombia time', async () => {
    renderSignedIn({ locale: 'en' });

    expect(await screen.findByRole('group', { name: 'Queued since' })).toHaveTextContent(/10:00\sAM/);
  });

  it('shows a dash when nothing is waiting in the queue', async () => {
    mockGet.mockResolvedValue({ data: buildSummary({ queue: { due: 0, oldest_queued_at: null } }) });

    renderSignedIn();

    expect(await screen.findByRole('group', { name: 'En cola desde' })).toHaveTextContent('—');
  });

  it('shows the number of the latest rejected document', async () => {
    renderSignedIn();

    const section = await screen.findByRole('region', { name: 'Último rechazo' });

    expect(within(section).getByText('SETP990000007')).toBeInTheDocument();
  });

  it('shows the issuer of the latest rejection', async () => {
    renderSignedIn();

    const section = await screen.findByRole('region', { name: 'Último rechazo' });

    expect(section).toHaveTextContent('Restaurante de Prueba SAS · NIT 900373115');
  });

  it('shows the first DIAN error of the latest rejection', async () => {
    renderSignedIn();

    const section = await screen.findByRole('region', { name: 'Último rechazo' });

    expect(section).toHaveTextContent('FAD06: El CUFE no corresponde.');
  });

  it('links the latest rejection to its document', async () => {
    renderSignedIn();

    const section = await screen.findByRole('region', { name: 'Último rechazo' });

    expect(within(section).getByRole('link', { name: 'Ver documento' })).toHaveAttribute('href', '/documents/7');
  });

  it('omits the latest rejection when there is none', async () => {
    mockGet.mockResolvedValue({ data: buildSummary({ last_rejection: null }) });

    renderSignedIn();

    expect(await screen.findByRole('group', { name: 'Total' })).toHaveTextContent('12');
    expect(screen.queryByRole('region', { name: 'Último rechazo' })).not.toBeInTheDocument();
  });

  it('shows the empty state while there are no documents', async () => {
    mockGet.mockResolvedValue({ data: buildEmptySummary() });

    renderSignedIn();

    expect(await screen.findByTestId('dashboard-empty-state')).toHaveTextContent('Todavía no hay documentos');
  });

  it('hides the state counters while there are no documents', async () => {
    mockGet.mockResolvedValue({ data: buildEmptySummary() });

    renderSignedIn();

    expect(await screen.findByTestId('dashboard-empty-state')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Validados' })).not.toBeInTheDocument();
  });

  it('shows an error when the summary cannot be loaded', async () => {
    mockGet.mockRejectedValue(httpError(500));

    renderSignedIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el tablero.');
  });

  it('loads the summary again from the retry button', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('group', { name: 'Total' })).toHaveTextContent('12');
  });

  it('renders the English copy when the locale is en', async () => {
    mockGet.mockResolvedValue({ data: buildEmptySummary() });

    renderSignedIn({ locale: 'en' });

    expect(await screen.findByRole('heading', { level: 2, name: 'There are no documents yet' })).toBeInTheDocument();
  });

  it('shows the open alerts and the rejection rate of the last 24 hours', async () => {
    renderSignedIn();

    const alerts = await screen.findByRole('region', { name: 'Alertas abiertas' });

    expect(within(alerts).getByRole('group', { name: 'Alertas abiertas' })).toHaveTextContent('3');
    expect(within(alerts).getByRole('group', { name: 'Rechazos en 24 h' })).toHaveTextContent('12,5');
    expect(within(alerts).getByText('1 crítica')).toBeInTheDocument();
  });

  it('says when the DIAN gave no answers in 24 hours', async () => {
    mockGet.mockResolvedValue({ data: buildSummary({ rejection_rate_24h: null }) });

    renderSignedIn();

    expect(await screen.findByText('Sin respuestas de la DIAN en 24 h')).toBeInTheDocument();
  });

  it('shows a healthy service', async () => {
    renderSignedIn();

    const health = await screen.findByRole('region', { name: 'Salud del servicio' });

    expect(health).toHaveTextContent('Todo en orden');
    expect(health).toHaveTextContent('Trabajador activo');
  });

  it('warns when the worker is silent and documents wait for the DIAN', async () => {
    mockGet.mockResolvedValue({
      data: buildSummary({
        health: buildHealth({ status: 'degraded', worker: { last_beat_at: null, ok: false }, dian: { in_contingency: 2, last_answer_at: null } }),
      }),
    });

    renderSignedIn();

    const health = await screen.findByRole('region', { name: 'Salud del servicio' });
    expect(health).toHaveTextContent('Con problemas');
    expect(within(health).getByText('El trabajador no responde')).toHaveClass('text-destructive');
    expect(within(health).getByText('2 documentos en contingencia')).toHaveClass('text-destructive');
  });
});

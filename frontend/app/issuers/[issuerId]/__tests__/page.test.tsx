import { describe, it, expect, beforeEach } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import IssuerDetailPage from '../page';
import { httpError } from '../../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../../lib/__tests__/intl';
import { buildAlert, buildIssuerDetail } from '../../../../lib/__tests__/operationsFactories';
import { useRequireAuth } from '../../../../lib/hooks/useRequireAuth';
import { api } from '../../../../lib/services/http';
import { useOperationsStore } from '../../../../lib/stores/operationsStore';

jest.mock('next/navigation', () => ({
  useParams: () => ({ issuerId: '3' }),
}));

jest.mock('../../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../../../lib/services/http', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockGet = api.get as unknown as jest.Mock;
const initialState = useOperationsStore.getState();
const NO_TEST_SET = {
  readiness: { environment: true, certificate: true, software: true, test_set_id: false, range: true },
  run: null,
};

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<IssuerDetailPage />);
}

describe('IssuerDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOperationsStore.setState(initialState, true);
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({ data: url.endsWith('/test-set/') ? NO_TEST_SET : buildIssuerDetail() }),
    );
    Object.assign(URL, { createObjectURL: jest.fn(() => 'blob:fiscal'), revokeObjectURL: jest.fn() });
  });

  it('renders nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<IssuerDetailPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the issuer data', async () => {
    renderSignedIn();

    expect(await screen.findByRole('heading', { level: 1, name: 'Restaurante de Prueba SAS' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'NIT' })).toHaveTextContent('900373115-3');
    expect(screen.getByRole('group', { name: 'Tipo de persona' })).toHaveTextContent('Persona jurídica');
  });

  it('lists the certificate, the software and the range usage', async () => {
    renderSignedIn();

    expect(await screen.findByRole('table', { name: 'Certificados del emisor' })).toHaveTextContent('CN=Restaurante de Prueba SAS');
    expect(screen.getByRole('table', { name: 'Software registrado ante la DIAN' })).toHaveTextContent('Con TestSetId');
    const ranges = screen.getByRole('table', { name: 'Rangos de numeración del emisor' });
    expect(within(ranges).getByText('95 %')).toHaveClass('text-destructive');
  });

  it('shows the open alerts with a link to their document', async () => {
    mockGet.mockResolvedValue({
      data: buildIssuerDetail({ alerts: [buildAlert({ kind: 'rejection', severity: 'critical', document: { id: 7, full_number: 'SETP990000007' } })] }),
    });

    renderSignedIn();

    const alerts = await screen.findByRole('region', { name: 'Alertas abiertas' });
    expect(alerts).toHaveTextContent('Rechazo de la DIAN');
    expect(within(alerts).getByRole('link', { name: 'SETP990000007' })).toHaveAttribute('href', '/documents/7');
  });

  it('warns when the issuer has nothing to invoice with', async () => {
    mockGet.mockResolvedValue({ data: buildIssuerDetail({ certificates: [], software: [], ranges: [], alerts: [] }) });

    renderSignedIn();

    expect(await screen.findByText('El emisor no tiene certificados.')).toBeInTheDocument();
    expect(screen.getByText('El emisor no ha registrado el software.')).toBeInTheDocument();
    expect(screen.getByText('El emisor no tiene rangos.')).toBeInTheDocument();
    expect(screen.getByText('Sin alertas abiertas.')).toBeInTheDocument();
  });

  it('downloads the contingency letter for the chosen period', async () => {
    renderSignedIn();
    await screen.findByRole('region', { name: 'Carta de contingencia a la DIAN' });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    mockGet.mockResolvedValueOnce({ data: new Blob(['%PDF']) });

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-03' } });
    await userEvent.click(screen.getByRole('button', { name: 'Descargar borrador' }));

    expect(mockGet).toHaveBeenLastCalledWith('console/issuers/3/contingency-letter/', {
      params: { from: '2026-10-01', to: '2026-10-03' },
      responseType: 'blob',
    });
    click.mockRestore();
  });

  it('says so when the letter cannot be generated', async () => {
    renderSignedIn();
    await screen.findByRole('region', { name: 'Carta de contingencia a la DIAN' });
    mockGet.mockRejectedValueOnce(httpError(400));

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Descargar borrador' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar la carta. Revisa las fechas.');
  });

  it('shows the not-found message for a missing issuer', async () => {
    mockGet.mockRejectedValue(httpError(404));

    renderSignedIn();

    expect(await screen.findByRole('heading', { name: 'No encontramos ese emisor' })).toBeInTheDocument();
  });

  it('retries after a failed load', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Restaurante de Prueba SAS' })).toBeInTheDocument();
  });
});

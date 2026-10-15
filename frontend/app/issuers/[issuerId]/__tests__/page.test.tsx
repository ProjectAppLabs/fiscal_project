import { describe, it, expect, beforeEach } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import IssuerDetailPage from '../page';
import { httpError } from '../../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../../lib/__tests__/intl';
import { buildAlert, buildIssuerDetail } from '../../../../lib/__tests__/operationsFactories';
import { useRequireAuth } from '../../../../lib/hooks/useRequireAuth';
import { api } from '../../../../lib/services/http';
import { useAuthStore } from '../../../../lib/stores/authStore';
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
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;
const mockPatch = api.patch as unknown as jest.Mock;
const initialState = useOperationsStore.getState();
const NO_TEST_SET = {
  readiness: { environment: true, certificate: true, software: true, test_set_id: false, range: true },
  run: null,
};
const PRODUCTION = {
  environment: '2',
  readiness: { test_set_accepted: false, certificate: true, software: false, range: false, gateway: true },
};

const RUNS = {
  count: 2,
  results: [
    { id: 2, state: 'accepted', test_set_id: 'set', created_at: '2026-10-14T05:00:00Z', updated_at: '2026-10-14T06:00:00Z', total: 50, accepted: 50, rejected: 0, pending: 0, error: '' },
    { id: 1, state: 'rejected', test_set_id: 'set', created_at: '2026-10-13T05:00:00Z', updated_at: '2026-10-13T06:00:00Z', total: 30, accepted: 0, rejected: 30, pending: 0, error: '' },
  ],
};

function answer(issuer = buildIssuerDetail()) {
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({
      data: url.endsWith('/test-set/runs/') ? RUNS : url.endsWith('/test-set/') ? NO_TEST_SET : url.endsWith('/production/') ? PRODUCTION : issuer,
    }),
  );
}

function signInAs(role: 'admin' | 'operator') {
  useAuthStore.setState({ user: { id: 1, email: 'ana@projectapp.co', first_name: 'Ana', last_name: '', role, is_staff: true } });
}

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<IssuerDetailPage />);
}

async function openTab(name: string) {
  await userEvent.click(await screen.findByRole('tab', { name: new RegExp(name) }));
}

describe('IssuerDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', '/issuers/3');
    useOperationsStore.setState(initialState, true);
    signInAs('operator');
    answer();
    Object.assign(URL, { createObjectURL: jest.fn(() => 'blob:fiscal'), revokeObjectURL: jest.fn() });
  });

  it('renders nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<IssuerDetailPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('titles the page with the issuer name', async () => {
    renderSignedIn();

    expect(await screen.findByRole('heading', { level: 1, name: 'Restaurante de Prueba SAS' })).toBeInTheDocument();
  });

  it('shows the environment next to the name', async () => {
    renderSignedIn();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Restaurante de Prueba SAS' });

    expect(heading.parentElement).toHaveTextContent('Habilitación');
  });

  it('opens the habilitación tab of an issuer still in habilitación', async () => {
    renderSignedIn();

    expect(await screen.findByRole('tab', { name: 'Habilitación' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the tab named in the URL', async () => {
    window.history.replaceState(null, '', '/issuers/3?tab=numbering');

    renderSignedIn();

    expect(await screen.findByRole('tab', { name: 'Numeración' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the issuer data in the summary', async () => {
    renderSignedIn();

    await openTab('Resumen');

    expect(screen.getByRole('group', { name: 'NIT' })).toHaveTextContent('900373115-3');
    expect(screen.getByRole('group', { name: 'Tipo de persona' })).toHaveTextContent('Persona jurídica');
  });

  it('shows the life cycle up to what is missing', async () => {
    renderSignedIn();

    const lifecycle = await screen.findByRole('list', { name: 'Ciclo de vida del emisor' });

    expect(within(lifecycle).getAllByRole('listitem')[0]).toHaveTextContent('InscritoFalta completar');
  });

  it('offers to complete a half-done enrolment', async () => {
    renderSignedIn();

    expect(await screen.findByRole('link', { name: 'Completar inscripción' })).toHaveAttribute('href', '/onboarding?issuer=3');
  });

  it('lists the certificate and the software', async () => {
    renderSignedIn();

    await openTab('Certificados y software');

    expect(screen.getByRole('table', { name: 'Certificados del emisor' })).toHaveTextContent('CN=Restaurante de Prueba SAS');
    expect(screen.getByRole('table', { name: 'Software registrado ante la DIAN' })).toHaveTextContent('Con TestSetId');
  });

  it('flags a range almost used up', async () => {
    renderSignedIn();

    await openTab('Numeración');

    expect(within(screen.getByRole('table', { name: 'Rangos de numeración del emisor' })).getByText('95 %')).toHaveClass('text-danger-fg');
  });

  it('shows the open alerts with a link to their document', async () => {
    answer(buildIssuerDetail({ alerts: [buildAlert({ kind: 'rejection', severity: 'critical', document: { id: 7, full_number: 'SETP990000007' } })] }));
    renderSignedIn();

    await openTab('Resumen');

    const alerts = screen.getByRole('region', { name: 'Alertas abiertas' });
    expect(alerts).toHaveTextContent('Rechazo de la DIAN');
    expect(within(alerts).getByRole('link', { name: 'SETP990000007' })).toHaveAttribute('href', '/documents/7');
  });

  it('warns when the issuer has no certificate', async () => {
    answer(buildIssuerDetail({ certificates: [], software: [], ranges: [], alerts: [] }));
    renderSignedIn();

    await openTab('Certificados y software');

    expect(screen.getByText('El emisor no tiene certificados.')).toBeInTheDocument();
  });

  it('warns when the issuer has no range', async () => {
    answer(buildIssuerDetail({ certificates: [], software: [], ranges: [], alerts: [] }));
    renderSignedIn();

    await openTab('Numeración');

    expect(screen.getByText('El emisor no tiene rangos.')).toBeInTheDocument();
  });

  it('replaces the certificate from its tab', async () => {
    mockPost.mockResolvedValue({ data: { id: 2, subject: 'CN=Restaurante de Prueba SAS', not_after: '2028-10-05T00:00:00Z', chain_complete: true } });
    renderSignedIn();
    await openTab('Certificados y software');

    await userEvent.click(screen.getByRole('button', { name: 'Reemplazar certificado' }));
    fireEvent.change(screen.getByLabelText('Archivo del certificado'), { target: { files: [new File(['p12'], 'nuevo.p12')] } });
    await userEvent.type(screen.getByLabelText('Contraseña del certificado'), 'clave');
    // jsdom never treats a required file input as filled, so the form is submitted directly.
    fireEvent.submit(screen.getByLabelText('Contraseña del certificado').closest('form') as HTMLFormElement);

    expect(mockPost).toHaveBeenCalledWith('console/issuers/3/certificate/', expect.any(FormData));
  });

  it('adds a contingency range from the numbering tab', async () => {
    mockPost.mockResolvedValue({ data: { id: 9, prefix: 'PAP' } });
    renderSignedIn();
    await openTab('Numeración');

    await userEvent.click(screen.getByRole('button', { name: 'Agregar rango' }));
    await userEvent.click(screen.getByRole('radio', { name: /Contingencia/ }));
    await userEvent.type(screen.getByLabelText('Número de resolución'), '18764000009');
    await userEvent.type(screen.getByLabelText('Prefijo'), 'pap');
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Vigente desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Vigente hasta'), { target: { value: '2028-10-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar rango' }));

    expect(mockPost).toHaveBeenCalledWith('console/issuers/3/ranges/', expect.objectContaining({ kind: 'contingency', prefix: 'PAP', number_to: 500 }));
  });

  it('downloads the contingency letter for the chosen period', async () => {
    renderSignedIn();
    await openTab('Contingencia');
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
    await openTab('Contingencia');
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

  it('corrects the issuer data without sending the NIT', async () => {
    mockPatch.mockResolvedValue({ data: buildIssuerDetail() });
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar datos' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('Razón social o nombre'));
    await userEvent.type(within(dialog).getByLabelText('Razón social o nombre'), 'La Prueba SAS');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar datos' }));

    expect(mockPatch).toHaveBeenCalledWith('console/issuers/3/', expect.objectContaining({ legal_name: 'La Prueba SAS' }));
    expect(mockPatch.mock.calls[0][1]).not.toHaveProperty('nit');
  });

  it('lets an administrator switch the issuer off after confirming', async () => {
    signInAs('admin');
    mockPost.mockResolvedValue({ data: { id: 3, active: false } });
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar emisor' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar emisor' }));

    expect(mockPost).toHaveBeenCalledWith('console/issuers/3/activation/', { active: false });
  });

  it('hides the switch-off from operators', async () => {
    renderSignedIn();

    await screen.findByRole('button', { name: 'Editar datos' });

    expect(screen.getByRole('button', { name: 'Editar datos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar emisor' })).not.toBeInTheDocument();
  });

  it('lets an administrator switch a range off', async () => {
    signInAs('admin');
    mockPatch.mockResolvedValue({ data: {} });
    renderSignedIn();
    await openTab('Numeración');

    await userEvent.click(within(screen.getByRole('table', { name: 'Rangos de numeración del emisor' })).getByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }));

    expect(mockPatch).toHaveBeenCalledWith('console/issuers/3/ranges/5/', { active: false });
  });

  it('lists the earlier runs of the test set', async () => {
    renderSignedIn();

    const runs = await screen.findByRole('table', { name: 'Corridas anteriores del set' });

    expect(runs).toHaveTextContent('50 de 50 aceptados');
  });

  it('shows the host the issuer is bound to', async () => {
    answer(buildIssuerDetail({ origin_host: 'restaurante-x.waiter.co', client_domain: 'waiter.co', client_allow_subdomains: true }));
    renderSignedIn();
    await openTab('Resumen');

    expect(screen.getByRole('group', { name: 'Origen' })).toHaveTextContent('restaurante-x.waiter.co');
  });

  it('rebinds the issuer to another host as an administrator', async () => {
    signInAs('admin');
    answer(buildIssuerDetail({ origin_host: 'restaurante-x.waiter.co', client_domain: 'waiter.co', client_allow_subdomains: true }));
    mockPatch.mockResolvedValue({ data: buildIssuerDetail() });
    renderSignedIn();
    await openTab('Resumen');

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar origen' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('Origen'));
    await userEvent.type(within(dialog).getByLabelText('Origen'), 'restaurante-y.waiter.co');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar origen' }));

    expect(mockPatch).toHaveBeenCalledWith('console/issuers/3/', { origin_host: 'restaurante-y.waiter.co' });
  });
});

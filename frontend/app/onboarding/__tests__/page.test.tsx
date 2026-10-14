import { describe, it, expect, beforeEach } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OnboardingPage from '../page';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { buildClientSystem } from '../../../lib/__tests__/operationsFactories';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import { useOperationsStore } from '../../../lib/stores/operationsStore';

jest.mock('../../../lib/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../../lib/services/http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;
const initialState = useOperationsStore.getState();

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<OnboardingPage />);
}

async function chooseWaiter() {
  await screen.findByRole('option', { name: 'Waiter' });
  await userEvent.selectOptions(screen.getByLabelText('Sistema cliente existente'), 'Waiter');
  await userEvent.click(screen.getByRole('button', { name: 'Usar este sistema' }));
}

async function fillIssuer() {
  await userEvent.type(screen.getByLabelText('NIT (sin dígito de verificación)'), '900373115');
  await userEvent.type(screen.getByLabelText('Dígito de verificación'), '3');
  await userEvent.type(screen.getByLabelText('Razón social o nombre'), 'ProjectApp');
  await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 10');
  await userEvent.type(screen.getByLabelText('Municipio'), '05001');
  await userEvent.type(screen.getByLabelText('Correo para facturación'), 'f@projectapp.co');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The wizard keeps the issuer in the URL to resume: start every test without it.
    window.history.replaceState(null, '', '/onboarding');
    useOperationsStore.setState(initialState, true);
    mockGet.mockResolvedValue({ data: { count: 1, results: [buildClientSystem()] } });
  });

  it('renders nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<OnboardingPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the secret of a new client system once, before moving on', async () => {
    renderSignedIn();
    mockPost.mockResolvedValueOnce({ data: { id: 5, name: 'ProjectApp', key_id: 'fk_abc', secret: 'secreto-largo' } });

    await userEvent.type(screen.getByLabelText('Nombre del sistema nuevo'), 'ProjectApp');
    await userEvent.click(screen.getByRole('button', { name: 'Crear sistema cliente' }));

    expect(await screen.findByText('secreto-largo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ya lo guardé' }));
    expect(screen.getByRole('region', { name: 'Datos del emisor tal como están en el RUT' })).toBeInTheDocument();
  });

  it('enrols the issuer with the department taken from the municipality', async () => {
    renderSignedIn();
    await chooseWaiter();
    mockPost.mockResolvedValueOnce({ data: { id: 3, nit: '900373115', legal_name: 'ProjectApp' } });

    await fillIssuer();

    expect(mockPost).toHaveBeenCalledWith('console/issuers/create/', expect.objectContaining({
      client_id: 1, nit: '900373115', dv: '3', department_code: '05', environment: '2', tax_responsibilities: ['R-99-PN'],
    }));
    expect(await screen.findByRole('region', { name: 'Certificado digital del emisor' })).toBeInTheDocument();
  });

  it('shows why a step was refused', async () => {
    renderSignedIn();
    await chooseWaiter();
    mockPost.mockRejectedValueOnce({ response: { data: { dv: ['El dígito de verificación no corresponde al NIT.'] } } });

    await fillIssuer();

    expect(await screen.findByRole('alert')).toHaveTextContent('El dígito de verificación no corresponde al NIT.');
  });

  it('walks through certificate, software and range to the end', async () => {
    renderSignedIn();
    await chooseWaiter();
    mockPost
      .mockResolvedValueOnce({ data: { id: 3 } })
      .mockResolvedValueOnce({ data: { id: 1, subject: 'CN=ProjectApp', not_after: '2027-10-05T00:00:00Z' } })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} });
    await fillIssuer();

    fireEvent.change(await screen.findByLabelText('Archivo del certificado'), {
      target: { files: [new File(['p12'], 'c.p12', { type: 'application/x-pkcs12' })] },
    });
    await userEvent.type(screen.getByLabelText('Contraseña del certificado'), 'clave');
    // jsdom does not count a file assigned from a test as filling a required input; the browser does (E2E).
    fireEvent.submit(screen.getByLabelText('Contraseña del certificado').closest('form') as HTMLFormElement);
    expect(await screen.findByRole('status')).toHaveTextContent('Certificado de CN=ProjectApp');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await userEvent.type(screen.getByLabelText('Identificador del software'), 'sw-123');
    await userEvent.type(screen.getByLabelText('PIN del software'), '12345');
    await userEvent.type(screen.getByLabelText('TestSetId'), 'set-1');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByLabelText('Prefijo')).toHaveValue('SETP');
    fireEvent.change(screen.getByLabelText('Clave técnica'), { target: { value: 'clave-tecnica' } });
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('link', { name: 'Ir a la ficha y correr el set' })).toHaveAttribute('href', '/issuers/3?tab=habilitation');
    expect(mockPost).toHaveBeenLastCalledWith('console/issuers/3/ranges/', expect.objectContaining({ technical_key: 'clave-tecnica', number_from: 990000000 }));
  });

  it('accepts the certificate and the key as separate files', async () => {
    renderSignedIn();
    await chooseWaiter();
    mockPost
      .mockResolvedValueOnce({ data: { id: 3 } })
      .mockResolvedValueOnce({ data: { id: 1, subject: 'CN=ProjectApp', not_after: '2027-10-05T00:00:00Z', chain_complete: false } });
    await fillIssuer();

    await userEvent.click(await screen.findByLabelText(/El certificado \(.cer/));
    fireEvent.change(screen.getByLabelText('Certificado (.cer, .crt, .pem o el .zip de la entidad)'), {
      target: { files: [new File(['cer'], '7674.cer')] },
    });
    fireEvent.change(screen.getByLabelText('Llave privada (.key)'), { target: { files: [new File(['key'], 'private.key')] } });
    fireEvent.submit(screen.getByLabelText('Llave privada (.key)').closest('form') as HTMLFormElement);

    expect(await screen.findByRole('status')).toHaveTextContent('Certificado de CN=ProjectApp');
    expect(screen.getByText(/No se pudo descargar la cadena de la entidad/)).toBeInTheDocument();
  });

  it('fills the check digit from the NIT', async () => {
    renderSignedIn();
    await chooseWaiter();

    await userEvent.type(screen.getByLabelText('NIT (sin dígito de verificación)'), '1021513348');

    expect(screen.getByLabelText('Dígito de verificación')).toHaveValue('7');
  });

  it('drops «no aplica» when a real responsibility is chosen', async () => {
    renderSignedIn();
    await chooseWaiter();

    await userEvent.click(screen.getByRole('checkbox', { name: /Gran contribuyente/ }));

    expect(screen.getByRole('checkbox', { name: /Gran contribuyente/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /No aplica/ })).not.toBeChecked();
  });

  it('goes back to the previous step', async () => {
    renderSignedIn();
    await chooseWaiter();

    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }));

    expect(screen.getByRole('region', { name: '¿Por qué sistema llega el emisor?' })).toBeInTheDocument();
  });

  it('resumes a half-done enrolment at its first missing step', async () => {
    window.history.replaceState(null, '', '/onboarding?issuer=3');
    mockGet.mockResolvedValue({ data: { readiness: { environment: true, certificate: true, software: false, test_set_id: false, range: false }, run: null } });

    renderSignedIn();

    expect(await screen.findByRole('region', { name: 'Software registrado en la DIAN' })).toBeInTheDocument();
  });
});

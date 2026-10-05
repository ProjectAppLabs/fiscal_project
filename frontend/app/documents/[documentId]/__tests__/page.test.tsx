import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DocumentDetailPage from '../page';
import { buildDocumentDetail, httpError } from '../../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../../lib/hooks/useRequireAuth';
import { api } from '../../../../lib/services/http';
import { useConsoleStore } from '../../../../lib/stores/consoleStore';

jest.mock('next/navigation', () => ({
  useParams: () => ({ documentId: '7' }),
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
const initialConsoleState = useConsoleStore.getState();

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<DocumentDetailPage />);
}

describe('DocumentDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConsoleStore.setState(initialConsoleState, true);
    mockGet.mockResolvedValue({ data: buildDocumentDetail() });
  });

  it('renders nothing when the user has no session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<DocumentDetailPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('requests the document named in the route', async () => {
    renderSignedIn();

    await screen.findByRole('heading', { level: 1, name: 'SETP990000007' });

    expect(mockGet).toHaveBeenCalledWith('console/documents/7/');
  });

  it.each([
    ['Tipo', 'Factura'],
    ['Estado', 'Rechazado'],
    ['Emisor', 'Restaurante de Prueba SAS · NIT 900373115'],
    ['Sistema cliente', 'Waiter'],
    ['Intentos', '1'],
    ['Clave de idempotencia', 'waiter-order-42'],
    ['CUFE', 'a1b2c3d4e5f6a7b8c9d0'],
  ])('shows the %s field as %s', async (label, value) => {
    renderSignedIn();

    expect(await screen.findByRole('group', { name: label })).toHaveTextContent(value);
  });

  it('shows a dash for a document the DIAN has not validated', async () => {
    renderSignedIn();

    expect(await screen.findByRole('group', { name: 'Validado' })).toHaveTextContent('—');
  });

  it('links to the DIAN QR in a new tab', async () => {
    renderSignedIn();

    const link = await screen.findByRole('link', { name: 'Ver código QR' });

    expect(link).toHaveAttribute('href', 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=a1b2c3');
  });

  it('hides the CUFE before the document has one', async () => {
    mockGet.mockResolvedValue({ data: buildDocumentDetail({ cufe: null, qr_url: null }) });

    renderSignedIn();

    expect(await screen.findByRole('group', { name: 'Clave de idempotencia' })).toHaveTextContent('waiter-order-42');
    expect(screen.queryByRole('group', { name: 'CUFE' })).not.toBeInTheDocument();
  });

  it('links a note to its original document', async () => {
    mockGet.mockResolvedValue({ data: buildDocumentDetail({ kind: 'credit_note', original: 3 }) });

    renderSignedIn();

    expect(await screen.findByRole('link', { name: 'Ver documento 3' })).toHaveAttribute('href', '/documents/3');
  });

  it('shows a DIAN error with its rule', async () => {
    renderSignedIn();

    const section = await screen.findByRole('region', { name: 'Errores de la DIAN' });

    expect(within(section).getByRole('listitem')).toHaveTextContent('FAD06: El CUFE no corresponde.');
  });

  it('shows a DIAN error sent as plain text', async () => {
    mockGet.mockResolvedValue({ data: buildDocumentDetail({ errors: ['Regla 90: documento procesado anteriormente.'] }) });

    renderSignedIn();

    const section = await screen.findByRole('region', { name: 'Errores de la DIAN' });

    expect(within(section).getByRole('listitem')).toHaveTextContent('Regla 90: documento procesado anteriormente.');
  });

  it('says the DIAN reported no errors when the list is empty', async () => {
    mockGet.mockResolvedValue({ data: buildDocumentDetail({ errors: [] }) });

    renderSignedIn();

    expect(await screen.findByText('La DIAN no reportó errores.')).toBeInTheDocument();
  });

  it.each([
    ['the artifact kind', 'signed_xml'],
    ['the artifact size', '2 KB'],
    ['the abbreviated sha256', '0123456789ab…'],
  ])('shows %s', async (_field, text) => {
    renderSignedIn();

    const table = await screen.findByRole('table', { name: 'Artefactos guardados' });

    expect(within(table).getByText(text)).toBeInTheDocument();
  });

  it('offers no download for the artifacts', async () => {
    renderSignedIn();

    const section = await screen.findByRole('region', { name: 'Artefactos' });

    expect(within(section).getByText('signed_xml')).toBeInTheDocument();
    expect(within(section).queryByRole('link')).not.toBeInTheDocument();
  });

  it('says there are no artifacts yet when the list is empty', async () => {
    mockGet.mockResolvedValue({ data: buildDocumentDetail({ artifacts: [] }) });

    renderSignedIn();

    expect(await screen.findByText('Todavía no hay artefactos.')).toBeInTheDocument();
  });

  it('shows each event of the history with its state', async () => {
    renderSignedIn();

    const section = await screen.findByRole('region', { name: 'Historia' });

    expect(within(section).getByRole('listitem')).toHaveTextContent('Rechazado');
  });

  it('shows the event time in Colombia time', async () => {
    renderSignedIn();

    const section = await screen.findByRole('region', { name: 'Historia' });

    expect(within(section).getByRole('listitem')).toHaveTextContent(/10:01/);
  });

  it('says there are no events yet when the history is empty', async () => {
    mockGet.mockResolvedValue({ data: buildDocumentDetail({ events: [] }) });

    renderSignedIn();

    expect(await screen.findByText('Todavía no hay eventos.')).toBeInTheDocument();
  });

  it('shows the not found message for a missing document', async () => {
    mockGet.mockRejectedValue(httpError(404));

    renderSignedIn();

    expect(await screen.findByRole('heading', { name: 'No encontramos ese documento' })).toBeInTheDocument();
  });

  it('links back to the document list from a missing document', async () => {
    mockGet.mockRejectedValue(httpError(404));

    renderSignedIn();

    await screen.findByRole('heading', { name: 'No encontramos ese documento' });
    expect(screen.getByRole('link', { name: /Volver a documentos/ })).toHaveAttribute('href', '/documents');
  });

  it('shows an error when the document cannot be loaded', async () => {
    mockGet.mockRejectedValue(httpError(500));

    renderSignedIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el documento.');
  });

  it('loads the document again from the retry button', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'SETP990000007' })).toBeInTheDocument();
  });
});

import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ApiDocsLayout from '../layout';
import ApiDocsPage from '../[[...slug]]/page';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import { useApiDocsStore } from '../../../lib/stores/apiDocsStore';

const mockSlug = jest.fn(() => ['introduccion']);
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ slug: mockSlug() }),
  usePathname: () => `/api-docs/${mockSlug()[0]}`,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../../lib/hooks/useRequireAuth', () => ({ useRequireAuth: jest.fn() }));
jest.mock('../../../lib/services/http', () => ({ api: { get: jest.fn() } }));

const mockUseRequireAuth = useRequireAuth as unknown as jest.Mock;
const mockGet = api.get as unknown as jest.Mock;
const initialState = useApiDocsStore.getState();
const DATA = {
  api_base_url: 'https://fiscal.projectapp.test',
  spec: {
    info: { title: 'Fiscal.', version: '1' },
    tags: [{ name: 'Documentos' }],
    paths: {
      '/api/v1/documents/create/': {
        post: { tags: ['Documentos'], summary: 'Emitir un documento', responses: { '202': { description: 'Recibido y en cola.' } } },
      },
    },
    webhooks: { ping: { post: { summary: 'Aviso de prueba' } } },
  },
};

function renderPage(slug: string) {
  mockSlug.mockReturnValue([slug]);
  return renderWithIntl(
    <ApiDocsLayout>
      <ApiDocsPage />
    </ApiDocsLayout>,
  );
}

describe('API docs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    useApiDocsStore.setState(initialState, true);
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
    mockGet.mockResolvedValue({ data: DATA });
    window.IntersectionObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })) as unknown as typeof IntersectionObserver;
  });

  it('shows nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderPage('introduccion');

    expect(container).toBeEmptyDOMElement();
  });

  it('opens the page named in the address', () => {
    renderPage('autenticacion');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Autenticación y firma');
  });

  it('marks the open page in the sidebar', () => {
    renderPage('origen');

    expect(screen.getAllByRole('link', { name: 'Origen y dominios' })[0]).toHaveAttribute('aria-current', 'page');
  });

  it('answers an unknown page with not found', () => {
    renderPage('no-existe');

    expect(screen.getByText('Esa página de la documentación no existe.')).toBeInTheDocument();
  });

  it('switches the examples to production', async () => {
    renderPage('emitir-documentos');

    await userEvent.click(screen.getAllByRole('radio', { name: 'Producción' })[0]);

    expect(screen.getByRole('article')).toHaveTextContent('"prefix": "FE1"');
  });

  it('builds the reference from the specification', async () => {
    renderPage('referencia');

    expect(await screen.findByRole('heading', { name: 'POST /api/v1/documents/create/' })).toBeInTheDocument();
  });

  it('lists the notice events from the specification', async () => {
    renderPage('eventos');

    expect(await screen.findByRole('heading', { level: 2, name: /ping/ })).toBeInTheDocument();
  });

  it('finds an endpoint from the search', async () => {
    renderPage('introduccion');
    await screen.findByText(/Fiscal. es el servicio/);

    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.type(screen.getByRole('textbox', { name: 'Qué buscas' }), 'emitir un');
    await userEvent.click(within(screen.getByRole('list', { name: 'Resultados' })).getAllByRole('button')[0]);

    expect(mockPush).toHaveBeenCalledWith('/api-docs/referencia#post-api-v1-documents-create');
  });
});

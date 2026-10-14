import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import HealthPage from '../page';
import { buildHealth, httpError } from '../../../lib/__tests__/consoleFactories';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useRequireAuth } from '../../../lib/hooks/useRequireAuth';
import { api } from '../../../lib/services/http';
import type { HealthDetail } from '../../../lib/services/support';

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

function buildHealthDetail(overrides: Partial<HealthDetail> = {}): HealthDetail {
  return {
    ...buildHealth(),
    documents: { queued: 3, transmitting: 0, contingency_dian: 1, contingency_issuer: 0 },
    notices: { pending: 2, failed: 1 },
    checked_at: '2026-10-05T12:00:00Z',
    ...overrides,
  };
}

function renderSignedIn() {
  mockUseRequireAuth.mockReturnValue({ isAuthenticated: true });
  return renderWithIntl(<HealthPage />);
}

describe('HealthPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: buildHealthDetail() });
  });

  it('renders nothing without a session', () => {
    mockUseRequireAuth.mockReturnValue({ isAuthenticated: false });

    const { container } = renderWithIntl(<HealthPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('asks the console health endpoint', async () => {
    renderSignedIn();

    await screen.findByText('Todo en orden.');

    expect(mockGet).toHaveBeenCalledWith('console/health/');
  });

  it('explains what to do when the worker is silent', async () => {
    mockGet.mockResolvedValue({ data: buildHealthDetail({ status: 'degraded', worker: { last_beat_at: null, ok: false } }) });
    renderSignedIn();

    expect(await screen.findByText('Sin el trabajador, los documentos se quedan en cola. Avísale a quien administra el servidor.')).toBeInTheDocument();
  });

  it('links the queued documents to the filtered list', async () => {
    renderSignedIn();

    expect(await screen.findByRole('link', { name: /Documentos en cola/ })).toHaveAttribute('href', '/documents?state=queued');
  });

  it('counts the failed notices', async () => {
    renderSignedIn();

    expect(await screen.findByRole('link', { name: /Avisos fallidos/ })).toHaveTextContent('1');
  });

  it('retries after a failed check', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    renderSignedIn();

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Todo en orden.')).toBeInTheDocument();
  });
});

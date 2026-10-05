import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TestSetPanel } from '../TestSetPanel';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { api } from '../../../lib/services/http';
import type { TestSetRun } from '../../../lib/services/onboarding';

jest.mock('../../../lib/services/http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;
const READY = { environment: true, certificate: true, software: true, test_set_id: true, range: true };
const RUN: TestSetRun = {
  id: 9,
  state: 'processing',
  error: '',
  created_at: '2026-10-05T12:00:00Z',
  updated_at: '2026-10-05T12:00:00Z',
  documents: [{ kind: 'invoice', full_number: 'SETP990000000', code: 'abc', status: 'pending', messages: [], file_name: 'fv.xml' }],
  phases: [{ name: 'invoices', zip_key: 'zip-1', errors: [] }],
};

describe('TestSetPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { readiness: READY, run: null } });
  });

  it('lists what the issuer still lacks and keeps the button disabled', async () => {
    mockGet.mockResolvedValue({ data: { readiness: { ...READY, test_set_id: false }, run: null } });

    renderWithIntl(<TestSetPanel issuerId={3} />);

    expect(await screen.findByText(/✗ TestSetId/)).toHaveClass('text-destructive');
    expect(screen.getByRole('button', { name: 'Iniciar set de pruebas' })).toBeDisabled();
  });

  it('starts the set with the chosen number of invoices', async () => {
    renderWithIntl(<TestSetPanel issuerId={3} />);
    await screen.findByText(/✓ TestSetId/);
    mockPost.mockResolvedValueOnce({ data: RUN });

    await userEvent.clear(screen.getByLabelText('Facturas del set'));
    await userEvent.type(screen.getByLabelText('Facturas del set'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar set de pruebas' }));

    expect(mockPost).toHaveBeenCalledWith('console/issuers/3/test-set/', { invoices: 10 });
    expect(await screen.findByText('En proceso en la DIAN', { exact: false })).toBeInTheDocument();
  });

  it('asks the DIAN for the result and shows each rule', async () => {
    mockGet.mockResolvedValue({ data: { readiness: READY, run: RUN } });
    renderWithIntl(<TestSetPanel issuerId={3} />);
    mockPost.mockResolvedValueOnce({
      data: { ...RUN, state: 'rejected', documents: [{ ...RUN.documents[0], status: 'rejected', messages: [{ rule: 'FAJ43b', message: 'Nombre', severity: 'rechazo' }] }] },
    });

    const check = await screen.findByRole('button', { name: 'Consultar a la DIAN' });
    expect(screen.getByRole('button', { name: 'Iniciar set de pruebas' })).toBeDisabled();
    await userEvent.click(check);

    const table = await screen.findByRole('table', { name: 'Documentos del set de pruebas' });
    expect(within(table).getByText('Rechazado')).toHaveClass('text-destructive');
    expect(within(table).getByText('FAJ43b: Nombre')).toBeInTheDocument();
  });

  it('explains why the set could not start', async () => {
    renderWithIntl(<TestSetPanel issuerId={3} />);
    await screen.findByText(/✓ TestSetId/);
    mockPost.mockRejectedValueOnce({ response: { data: { detail: 'El rango de habilitación no tiene números suficientes.' } } });

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar set de pruebas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El rango de habilitación no tiene números suficientes.');
  });

  it('says when the set has not been run', async () => {
    renderWithIntl(<TestSetPanel issuerId={3} />);

    expect(await screen.findByText('Todavía no se ha corrido el set.')).toBeInTheDocument();
  });

  it('shows the error of a failed load', async () => {
    mockGet.mockRejectedValueOnce({ response: { data: { detail: 'No encontrado.' } } });

    renderWithIntl(<TestSetPanel issuerId={3} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontrado.');
  });
});

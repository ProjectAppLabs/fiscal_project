import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProductionPanel } from '../ProductionPanel';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { api } from '../../../lib/services/http';

jest.mock('../../../lib/services/http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;
const READY = { test_set_accepted: true, certificate: true, software: true, range: true, gateway: true };

describe('ProductionPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { environment: '2', readiness: { ...READY, software: false, range: false } } });
  });

  it('lists what production still needs', async () => {
    renderWithIntl(<ProductionPanel issuerId={3} />);

    expect(await screen.findByText(/✗ Software de producción/)).toHaveClass('text-destructive');
    expect(screen.getByText(/✓ Set de pruebas aceptado/)).toHaveClass('text-success');
  });

  it('copies the habilitación software', async () => {
    renderWithIntl(<ProductionPanel issuerId={3} />);
    mockPost.mockResolvedValueOnce({ data: { environment: '2', readiness: { ...READY, range: false } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Usar el software de habilitación' }));

    expect(mockPost).toHaveBeenCalledWith('console/issuers/3/production/copy-software/', {});
    expect(await screen.findByText(/✓ Software de producción/)).toBeInTheDocument();
  });

  it('keeps the switch disabled until everything is ready and confirmed', async () => {
    mockGet.mockResolvedValue({ data: { environment: '2', readiness: READY } });
    renderWithIntl(<ProductionPanel issuerId={3} />);

    const promote = await screen.findByRole('button', { name: 'Pasar a producción' });
    expect(promote).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(promote).toBeEnabled();
  });

  it('moves the issuer to production with an explicit confirmation', async () => {
    mockGet.mockResolvedValue({ data: { environment: '2', readiness: READY } });
    renderWithIntl(<ProductionPanel issuerId={3} />);
    mockPost.mockResolvedValueOnce({ data: { environment: '1', readiness: READY } });

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Pasar a producción' }));

    expect(mockPost).toHaveBeenCalledWith('console/issuers/3/production/promote/', { confirm: true });
    expect(await screen.findByText('En producción: sus documentos tienen efecto fiscal.')).toBeInTheDocument();
  });

  it('explains why fetching the numbering failed', async () => {
    mockGet.mockResolvedValue({ data: { environment: '2', readiness: { ...READY, range: false } } });
    renderWithIntl(<ProductionPanel issuerId={3} />);
    mockPost.mockRejectedValueOnce({ response: { data: { detail: 'La DIAN no entregó la numeración: sin permiso' } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Traer la numeración de la DIAN' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La DIAN no entregó la numeración: sin permiso');
  });
});

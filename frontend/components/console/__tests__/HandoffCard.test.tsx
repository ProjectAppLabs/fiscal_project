import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HandoffCard } from '../HandoffCard';
import { renderWithIntl } from '../../../lib/__tests__/intl';
import { useToastStore } from '../../ui/Toast';

const GUIDE = '# Guía\nEmisor: {{EMISOR}}\nConsola: {{CONSOLA_URL}}';
const mockFetch = jest.fn();
const mockWriteText = jest.fn();

function renderCard() {
  return renderWithIntl(<HandoffCard guides={['test-set']} issuer={{ id: 3, legal_name: 'Restaurante de Prueba SAS', nit: '900373115' }} />);
}

describe('HandoffCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    mockFetch.mockResolvedValue({ ok: true, text: async () => GUIDE });
    mockWriteText.mockResolvedValue(undefined);
    Object.assign(global, { fetch: mockFetch });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mockWriteText } });
  });

  it('asks for the guide of the step', async () => {
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Copiar guía: Correr el set de pruebas de la DIAN' }));

    expect(mockFetch).toHaveBeenCalledWith('/handoff/05-set-de-pruebas.md');
  });

  it('copies the guide with the issuer filled in', async () => {
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Copiar guía: Correr el set de pruebas de la DIAN' }));

    expect(mockWriteText).toHaveBeenCalledWith('# Guía\nEmisor: Restaurante de Prueba SAS (NIT 900373115)\nConsola: http://localhost');
  });

  it('downloads the guide as a markdown file', async () => {
    const createObjectURL = jest.fn(() => 'blob:guide');
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Descargar .md: Correr el set de pruebas de la DIAN' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('offers the download when the copy fails', async () => {
    mockWriteText.mockRejectedValue(new Error('denied'));
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Copiar guía: Correr el set de pruebas de la DIAN' }));

    expect(useToastStore.getState().toasts.map((item) => item.message)).toEqual(['No se pudo copiar. Descarga el .md y pégalo desde el archivo.']);
  });

  it('links to every guide', () => {
    renderCard();

    expect(screen.getByRole('link', { name: 'Ver todas las guías' })).toHaveAttribute('href', '/help');
  });
});

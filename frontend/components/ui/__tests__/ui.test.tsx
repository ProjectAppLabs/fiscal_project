import { describe, it, expect, beforeEach } from '@jest/globals';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { Button } from '../Button';
import { CopyButton } from '../Copy';
import { DataTable } from '../DataTable';
import { JsonViewer } from '../JsonViewer';
import { Lifecycle, Stepper } from '../Steps';
import { Tabs } from '../Tabs';
import { Toaster, toast, useToastStore } from '../Toast';
import { usageTone } from '../Progress';
import { renderWithIntl } from '../../../lib/__tests__/intl';

const setNarrowScreen = (narrow: boolean) => {
  (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
    matches: narrow,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
};

const ROWS = [{ id: 1, number: 'SETP990000007', state: 'Rechazado' }];
const COLUMNS = [
  { key: 'number', header: 'Número', mobile: 'title' as const, cell: (row: (typeof ROWS)[number]) => row.number },
  { key: 'state', header: 'Estado', mobile: 'badge' as const, cell: (row: (typeof ROWS)[number]) => row.state },
];

describe('Button', () => {
  it('says what it is doing while loading', () => {
    renderWithIntl(
      <Button loading loadingLabel="Guardando…">
        Guardar
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });
});

describe('DataTable', () => {
  beforeEach(() => setNarrowScreen(false));

  it('renders a table on wide screens', () => {
    renderWithIntl(<DataTable caption="Documentos" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} />);

    expect(screen.getByRole('table', { name: 'Documentos' })).toHaveTextContent('SETP990000007');
  });

  it('turns every row into a card on narrow screens', () => {
    setNarrowScreen(true);

    renderWithIntl(<DataTable caption="Documentos" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} />);

    expect(within(screen.getByRole('list', { name: 'Documentos' })).getByRole('listitem')).toHaveTextContent('SETP990000007Rechazado');
  });
});

describe('Tabs', () => {
  function Harness() {
    const [value, setValue] = useState<'a' | 'b'>('a');
    return (
      <Tabs
        label="Secciones"
        onChange={setValue}
        tabs={[
          { value: 'a', label: 'Resumen' },
          { value: 'b', label: 'Numeración' },
        ]}
        value={value}
      />
    );
  }

  it('selects a tab on click', async () => {
    renderWithIntl(<Harness />);

    await userEvent.click(screen.getByRole('tab', { name: 'Numeración' }));

    expect(screen.getByRole('tab', { name: 'Numeración' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves to the next tab with the right arrow', async () => {
    renderWithIntl(<Harness />);

    screen.getByRole('tab', { name: 'Resumen' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Numeración' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Lifecycle', () => {
  it('marks the current step', () => {
    renderWithIntl(
      <Lifecycle
        label="Ciclo de vida"
        steps={[
          { key: 'a', emoji: 'enrolled', title: 'Inscrito', caption: 'Listo', state: 'done' },
          { key: 'b', emoji: 'test-set', title: 'Set aceptado', caption: 'En curso', state: 'current' },
        ]}
      />,
    );

    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
  });
});

describe('Stepper', () => {
  it('goes back to a step already done', async () => {
    const onStepClick = jest.fn();
    renderWithIntl(<Stepper current={2} label="Pasos" onStepClick={onStepClick} steps={['Sistema', 'Emisor', 'Certificado']} />);

    await userEvent.click(screen.getByRole('button', { name: /Emisor/ }));

    expect(onStepClick).toHaveBeenCalledWith(1);
  });
});

describe('CopyButton', () => {
  it('copies the value to the clipboard', async () => {
    const user = userEvent.setup();
    renderWithIntl(<CopyButton value="cufe-123" />);

    await user.click(screen.getByRole('button', { name: 'Copiar' }));

    await expect(navigator.clipboard.readText()).resolves.toBe('cufe-123');
  });
});

describe('JsonViewer', () => {
  it('keeps the content folded until asked', async () => {
    renderWithIntl(<JsonViewer fileName="doc.json" title="Contenido recibido" value={{ total: '1000.00' }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Ver' }));

    expect(screen.getByText('"total": "1000.00"', { exact: false })).toBeInTheDocument();
  });
});

describe('Toaster', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }));

  it('shows a confirmation', () => {
    renderWithIntl(<Toaster />);

    act(() => toast('Alerta resuelta'));

    expect(screen.getByRole('status')).toHaveTextContent('Alerta resuelta');
  });
});

describe('usageTone', () => {
  it.each([
    [0.5, 'aurora'],
    [0.85, 'warning'],
    [0.95, 'danger'],
  ])('reads a usage of %s as %s', (share, tone) => {
    expect(usageTone(share)).toBe(tone);
  });
});

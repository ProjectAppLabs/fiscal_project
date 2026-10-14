import { describe, it, expect, beforeEach } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MunicipalityField } from '../MunicipalityField';
import { renderWithIntl } from '../../../lib/__tests__/intl';

const CATALOG = [
  ['05001', 'Medellín', 'Antioquia'],
  ['76001', 'Cali', 'Valle del Cauca'],
];

describe('MunicipalityField', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(CATALOG) })) as unknown as typeof fetch;
  });

  it('finds a municipality by its name without accents', async () => {
    renderWithIntl(<MunicipalityField id="municipality" onChange={jest.fn()} value="" />);

    await userEvent.type(screen.getByRole('combobox'), 'medel');

    expect(await screen.findByRole('option', { name: /Medellín/ })).toHaveTextContent('05001');
  });

  it('saves the DANE code of the chosen municipality', async () => {
    const onChange = jest.fn();
    renderWithIntl(<MunicipalityField id="municipality" onChange={onChange} value="" />);

    await userEvent.type(screen.getByRole('combobox'), 'cali');
    await userEvent.click(await screen.findByRole('option', { name: /Cali/ }));

    expect(onChange).toHaveBeenLastCalledWith('76001');
  });

  it('takes five digits as a DANE code typed directly', async () => {
    const onChange = jest.fn();
    renderWithIntl(<MunicipalityField id="municipality" onChange={onChange} value="" />);

    await userEvent.type(screen.getByRole('combobox'), '05001');

    expect(onChange).toHaveBeenLastCalledWith('05001');
  });
});

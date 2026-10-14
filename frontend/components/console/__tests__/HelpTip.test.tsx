import { describe, it, expect } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HelpTip } from '../HelpTip';
import { renderWithIntl } from '../../../lib/__tests__/intl';

async function open(topic: Parameters<typeof HelpTip>[0]['topic'], label: string) {
  renderWithIntl(<HelpTip label={label} topic={topic} />);
  await userEvent.click(screen.getByRole('button', { name: `Ayuda: ${label}` }));
  return screen.getByRole('note');
}

describe('HelpTip', () => {
  it('says where a field comes from', async () => {
    const note = await open('issuer.nit', 'NIT');

    expect(note).toHaveTextContent('RUT, casilla 5. Se escribe sin el dígito de verificación.');
  });

  it('warns that a secret is typed by the person', async () => {
    const note = await open('software.pin', 'PIN del software');

    expect(note).toHaveTextContent('Es secreto: escríbelo tú, nunca en un chat, correo o ticket.');
  });

  it('links to the page where the value is', async () => {
    await open('software.testSetId', 'TestSetId');

    expect(screen.getByRole('link', { name: 'Portal de habilitación DIAN' })).toHaveAttribute('href', 'https://catalogo-vpfe-hab.dian.gov.co/User/Login');
  });

  it('shows no secret warning for a public value', async () => {
    const note = await open('software.softwareId', 'Identificador del software');

    expect(note).toHaveTextContent('No es secreto.');
    expect(note).not.toHaveTextContent('Es secreto');
  });
});

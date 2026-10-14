import { describe, it, expect } from '@jest/globals';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InfoTip, bubblePosition } from '../InfoTip';
import { renderWithIntl } from '../../../lib/__tests__/intl';

function renderTip() {
  return renderWithIntl(
    <div>
      <InfoTip label="PIN del software">Lo eligió el comercio.</InfoTip>
      <p>Afuera</p>
    </div>,
  );
}

describe('InfoTip', () => {
  it('opens the explanation from its button', async () => {
    renderTip();

    await userEvent.click(screen.getByRole('button', { name: 'Ayuda: PIN del software' }));

    expect(screen.getByRole('note')).toHaveTextContent('Lo eligió el comercio.');
  });

  it('describes the button with the open explanation', async () => {
    renderTip();
    const button = screen.getByRole('button', { name: 'Ayuda: PIN del software' });

    await userEvent.click(button);

    expect(button).toHaveAccessibleDescription('Lo eligió el comercio.');
  });

  it('closes with Escape', async () => {
    renderTip();
    await userEvent.click(screen.getByRole('button', { name: 'Ayuda: PIN del software' }));

    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Ayuda: PIN del software' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes with a click outside', async () => {
    renderTip();
    await userEvent.click(screen.getByRole('button', { name: 'Ayuda: PIN del software' }));

    await userEvent.click(screen.getByText('Afuera'));

    expect(screen.getByRole('button', { name: 'Ayuda: PIN del software' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('stays open after a click inside the explanation', async () => {
    renderTip();
    await userEvent.click(screen.getByRole('button', { name: 'Ayuda: PIN del software' }));

    await userEvent.click(screen.getByRole('note'));

    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});

describe('bubblePosition', () => {
  it('opens under the button', () => {
    expect(bubblePosition({ left: 100, top: 200, bottom: 224 }, 1440, 900)).toEqual({ top: 230, left: 92, width: 320 });
  });

  it('keeps the bubble inside a phone screen', () => {
    expect(bubblePosition({ left: 300, top: 200, bottom: 224 }, 390, 844)).toEqual({ top: 230, left: 54, width: 320 });
  });

  it('narrows the bubble on a very small screen', () => {
    expect(bubblePosition({ left: 10, top: 200, bottom: 224 }, 320, 600)).toEqual({ top: 230, left: 16, width: 288 });
  });

  it('opens above a button near the bottom of the screen', () => {
    expect(bubblePosition({ left: 100, top: 820, bottom: 844 }, 1440, 900)).toEqual({ bottom: 86, left: 92, width: 320 });
  });
});

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { useHydrated } from '../useHydrated';

function Probe() {
  return <span>{useHydrated() ? 'cliente' : 'servidor'}</span>;
}

describe('useHydrated', () => {
  it('is false in the server render, so session-only markup is left out of the HTML', () => {
    expect(renderToString(<Probe />)).toContain('servidor');
  });

  it('is true once rendered in the browser', () => {
    render(<Probe />);

    expect(screen.getByText('cliente')).toBeInTheDocument();
  });
});

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { BRAND_NAME, FiscalLogo } from '../FiscalLogo';

describe('FiscalLogo', () => {
  it('spells the brand with its final period', () => {
    expect(BRAND_NAME).toBe('Fiscal.');
  });

  it('renders the wordmark text', () => {
    render(<FiscalLogo />);

    expect(screen.getByTestId('fiscal-logo')).toHaveTextContent('Fiscal.');
  });

  it('keeps the extra classes passed by the caller', () => {
    render(<FiscalLogo className="text-4xl" />);

    expect(screen.getByTestId('fiscal-logo')).toHaveClass('text-4xl');
  });
});

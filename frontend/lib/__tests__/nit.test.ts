import { describe, it, expect } from '@jest/globals';

import { checkDigit } from '../nit';

describe('checkDigit', () => {
  it.each([
    ['900373115', '3'],
    ['1021513348', '7'],
    ['800197268', '4'],
  ])('computes the DIAN check digit of %s as %s', (nit, digit) => {
    expect(checkDigit(nit)).toBe(digit);
  });

  it('returns nothing for a NIT with letters', () => {
    expect(checkDigit('90037A115')).toBe('');
  });
});

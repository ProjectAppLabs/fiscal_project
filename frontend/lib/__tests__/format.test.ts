import { describe, it, expect } from '@jest/globals';

import { formatBytes, formatDateTime, shortHash } from '../format';

describe('formatDateTime', () => {
  it('shows a UTC instant in Colombia time', () => {
    expect(formatDateTime('2026-10-04T15:00:00Z', 'en')).toMatch(/Oct 4, 2026.*10:00\sAM/);
  });

  it.each([null, undefined, '', 'not-a-date'])('renders %p as an em dash', (value) => {
    expect(formatDateTime(value, 'es')).toBe('—');
  });
});

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5 MB'],
  ])('formats %i bytes as %s', (size, expected) => {
    expect(formatBytes(size, 'en')).toBe(expected);
  });
});

describe('shortHash', () => {
  it('abbreviates a long hash to its first twelve characters', () => {
    expect(shortHash('0123456789abcdef0123')).toBe('0123456789ab…');
  });

  it('keeps a short hash whole', () => {
    expect(shortHash('abc123')).toBe('abc123');
  });
});

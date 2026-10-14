import { describe, it, expect } from '@jest/globals';

import { formatBytes, formatDate, formatDateTime, formatNumber, formatRelative, shortHash } from '../format';

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

describe('formatDate', () => {
  it('keeps a midnight UTC expiry on its Colombian day', () => {
    expect(formatDate('2027-10-05T05:00:00Z', 'en')).toBe('Oct 5, 2027');
  });

  it('reads a plain calendar day as that day', () => {
    expect(formatDate('2030-01-19', 'en')).toBe('Jan 19, 2030');
  });

  it.each([null, '', 'not-a-date'])('renders %p as an em dash', (value) => {
    expect(formatDate(value, 'es')).toBe('—');
  });
});

describe('formatRelative', () => {
  it('says how long ago something happened', () => {
    expect(formatRelative('2026-10-14T11:55:00Z', 'en', new Date('2026-10-14T12:00:00Z'))).toBe('5 min. ago');
  });

  it('says how far away something is', () => {
    expect(formatRelative('2026-10-17T12:00:00Z', 'en', new Date('2026-10-14T12:00:00Z'))).toBe('in 3 days');
  });
});

describe('formatNumber', () => {
  it('groups thousands the Colombian way', () => {
    expect(formatNumber(1284, 'es-CO')).toBe('1.284');
  });
});

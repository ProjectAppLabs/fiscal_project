import { describe, it, expect } from '@jest/globals';

import { DEFAULT_LOCALE, LOCALE_LABELS, SUPPORTED_LOCALES, isValidLocale, resolveLocale } from '../config';

describe('i18n config', () => {
  describe('isValidLocale', () => {
    it('returns true for supported locale "en"', () => {
      expect(isValidLocale('en')).toBe(true);
    });

    it('returns true for supported locale "es"', () => {
      expect(isValidLocale('es')).toBe(true);
    });

    it('returns false for unsupported locale', () => {
      expect(isValidLocale('fr')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidLocale('')).toBe(false);
    });
  });

  describe('resolveLocale', () => {
    it.each([
      ['es', 'es'],
      ['en', 'en'],
      ['fr', 'es'],
      [undefined, 'es'],
      [null, 'es'],
    ] as const)('resolves %p to %p', (input, expected) => {
      expect(resolveLocale(input)).toBe(expected);
    });
  });

  describe('constants', () => {
    it('exposes DEFAULT_LOCALE as "es"', () => {
      expect(DEFAULT_LOCALE).toBe('es');
    });

    it('exposes SUPPORTED_LOCALES containing "en" and "es"', () => {
      expect(SUPPORTED_LOCALES).toContain('en');
      expect(SUPPORTED_LOCALES).toContain('es');
    });

    it('exposes LOCALE_LABELS with English display name', () => {
      expect(LOCALE_LABELS.en).toBe('English');
    });

    it('exposes LOCALE_LABELS with Spanish display name', () => {
      expect(LOCALE_LABELS.es).toBe('Español');
    });
  });
});

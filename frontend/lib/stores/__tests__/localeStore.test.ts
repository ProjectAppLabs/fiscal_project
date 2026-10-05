import { describe, it, expect, beforeEach } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import Cookies from 'js-cookie';

import { useLocaleStore } from '../localeStore';

describe('localeStore', () => {
  beforeEach(() => {
    Cookies.remove('NEXT_LOCALE');
    useLocaleStore.setState({ locale: 'es' });
  });

  it('starts in Spanish', () => {
    const { result } = renderHook(() => useLocaleStore());

    expect(result.current.locale).toBe('es');
  });

  it('switches to a supported locale', () => {
    const { result } = renderHook(() => useLocaleStore());

    act(() => {
      result.current.setLocale('en');
    });

    expect(result.current.locale).toBe('en');
  });

  it('writes the chosen locale to the next-intl cookie', () => {
    const { result } = renderHook(() => useLocaleStore());

    act(() => {
      result.current.setLocale('en');
    });

    expect(Cookies.get('NEXT_LOCALE')).toBe('en');
  });

  it('ignores an unsupported locale', () => {
    const { result } = renderHook(() => useLocaleStore());

    act(() => {
      result.current.setLocale('fr');
    });

    expect(result.current.locale).toBe('es');
  });

  it('leaves the cookie untouched for an unsupported locale', () => {
    const { result } = renderHook(() => useLocaleStore());

    act(() => {
      result.current.setLocale('fr');
    });

    expect(Cookies.get('NEXT_LOCALE')).toBeUndefined();
  });
});

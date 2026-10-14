'use client';

import { useCallback } from 'react';

/**
 * Reads and writes query parameters with the browser History API, which Next keeps in sync. Filters and tabs live in
 * the URL so a search or a tab can be shared and survives going back from a detail page.
 */
export function useQueryParams() {
  const read = useCallback((name: string): string => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name) ?? '';
  }, []);

  const write = useCallback((values: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    for (const [name, value] of Object.entries(values)) {
      if (value) params.set(name, value);
      else params.delete(name);
    }
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);

  return { read, write };
}

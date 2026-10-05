'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * False while React hydrates the server HTML, true afterwards. The session lives in cookies the server render does
 * not read, so anything that depends on it must wait for this to avoid a hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

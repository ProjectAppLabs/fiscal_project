'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useHydrated } from '@/lib/hooks/useHydrated';
import { useAuthStore } from '@/lib/stores/authStore';

export const useRequireAuth = () => {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useHydrated();
  const syncFromCookies = useAuthStore((s) => s.syncFromCookies);

  useEffect(() => {
    syncFromCookies();
  }, [syncFromCookies]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/sign-in');
    }
  }, [isAuthenticated, router]);

  // The server render has no session: report it only once hydrated, so server and client HTML match.
  return { isAuthenticated: hydrated && isAuthenticated };
};

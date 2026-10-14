'use client';

import { useAuthStore } from '@/lib/stores/authStore';

/** Whether the signed-in operator is an administrator; the backend enforces it, this only hides what they cannot do. */
export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.user?.role === 'admin');
}

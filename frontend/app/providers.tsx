'use client';

import { useEffect } from 'react';

import { useAuthStore } from '@/lib/stores/authStore';
import { getAccessToken } from '@/lib/services/tokens';
import { ThemeProvider } from '@/components/theme-provider';

interface ProvidersProps {
  children: React.ReactNode;
}

function AuthInitializer() {
  const restoreUser = useAuthStore((s) => s.restoreUser);

  useEffect(() => {
    if (getAccessToken()) {
      void restoreUser();
    }
  }, [restoreUser]);

  return null;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AuthInitializer />
      {children}
    </ThemeProvider>
  );
}

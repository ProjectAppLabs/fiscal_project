'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { ROUTES } from '@/lib/constants';
import { getAccessToken } from '@/lib/services/tokens';

// The console has no public landing page: `/` only routes to the right place.
export default function HomePage() {
  const t = useTranslations('home');
  const router = useRouter();

  useEffect(() => {
    router.replace(getAccessToken() ? ROUTES.DASHBOARD : ROUTES.SIGN_IN);
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm text-muted-foreground" role="status">
        {t('redirecting')}
      </p>
    </main>
  );
}

'use client';

import { useTranslations } from 'next-intl';

import { FiscalLogo } from '@/components/brand/FiscalLogo';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { isAuthenticated } = useRequireAuth();

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-4xl">
        <FiscalLogo />
      </h1>
      <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>

      <section
        className="mt-10 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center"
        data-testid="dashboard-empty-state"
      >
        <h2 className="text-lg font-semibold">{t('emptyTitle')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
      </section>
    </main>
  );
}

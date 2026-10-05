'use client';

import { useTranslations } from 'next-intl';

import type { DocumentState } from '@/lib/services/console';

const STATE_TONE: Record<DocumentState, string> = {
  queued: 'bg-muted text-foreground',
  transmitting: 'bg-info/15 text-foreground',
  validated: 'bg-success/15 text-foreground',
  rejected: 'bg-destructive/15 text-foreground',
  contingency_dian: 'bg-warning/15 text-foreground',
  contingency_issuer: 'bg-warning/15 text-foreground',
};

export function DocumentStateBadge({ state }: { state: DocumentState }) {
  const t = useTranslations('console.state');

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATE_TONE[state]}`}>{t(state)}</span>
  );
}

export function ConsoleLoading() {
  const t = useTranslations('console');

  return (
    <p className="mt-10 text-sm text-muted-foreground" role="status">
      {t('loading')}
    </p>
  );
}

export function ConsoleLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations('console');

  return (
    <div className="mt-10 rounded-2xl border border-destructive/40 bg-card px-6 py-8 text-center">
      <p className="text-sm text-destructive" role="alert">
        {message}
      </p>
      <button
        className="mt-4 rounded-full border border-border px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onRetry}
        type="button"
      >
        {t('retry')}
      </button>
    </div>
  );
}

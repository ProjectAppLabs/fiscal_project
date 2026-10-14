'use client';

import { useTranslations } from 'next-intl';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { ErrorState, SkeletonCard } from '@/components/ui/States';
import type { DocumentState } from '@/lib/services/console';

/** Each document state has a color family and a word; the color never goes alone. */
export const STATE_TONE: Record<DocumentState, BadgeTone> = {
  queued: 'pending',
  transmitting: 'info',
  validated: 'success',
  rejected: 'danger',
  contingency_dian: 'warning',
  contingency_issuer: 'warning',
};

export function DocumentStateBadge({ state, size = 'sm' }: { state: DocumentState; size?: 'sm' | 'md' | 'lg' }) {
  const t = useTranslations('console.state');

  return (
    <Badge size={size} tone={STATE_TONE[state]}>
      {t(state)}
    </Badge>
  );
}

export function ConsoleLoading({ lines = 4 }: { lines?: number }) {
  return <SkeletonCard className="mt-2" lines={lines} />;
}

export function ConsoleLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <ErrorState message={message} onRetry={onRetry} />;
}

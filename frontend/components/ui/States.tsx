'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Emoji, EmojiTile, type EmojiName } from './Emoji';

/** Nothing to show yet: the Boreal aurora behind, a big emoji, a title, one line and maybe an action. */
export function EmptyState({ emoji = 'empty', title, body, action, className }: EmptyStateProps) {
  return (
    <section className={cn('aurora-boreal relative overflow-hidden rounded-card bg-surface px-6 py-12 text-center shadow-rest', className)} data-testid="empty-state">
      <Emoji className="mx-auto" name={emoji} size={64} />
      <h2 className="mt-4 text-[17px] font-bold text-ink">{title}</h2>
      {body ? <p className="mx-auto mt-1.5 max-w-md text-[15px] text-ink-2">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </section>
  );
}

/** Could not load: what failed, that nothing was lost, and «Reintentar». */
export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  const t = useTranslations('ui');

  return (
    <section className={cn('rounded-card bg-surface p-6 shadow-rest', className)}>
      <EmojiTile name="rejected" tone="danger" />
      <p className="mt-4 text-[17px] font-bold text-ink" role="alert">
        {message}
      </p>
      <p className="mt-1 text-[15px] text-ink-2">{t('errorBody')}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} size="sm" variant="soft">
          {t('retry')}
        </Button>
      ) : null}
    </section>
  );
}

export function NotFoundState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <EmptyState action={action} body={body} emoji="search" title={title} />;
}

/** Same size as the real thing, so the page does not jump when the data arrives. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton block rounded-xs', className)} />;
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  const t = useTranslations('ui');

  return (
    <div aria-busy className={cn('rounded-card bg-surface p-6 shadow-rest', className)} role="status">
      <span className="sr-only">{t('loading')}</span>
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-sm" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton className={cn('h-3.5', index % 2 ? 'w-3/5' : 'w-full')} key={index} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  const t = useTranslations('ui');

  return (
    <div aria-busy className="rounded-card bg-surface p-5 shadow-rest" role="status">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <div className="flex items-center gap-4" key={index}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  emoji?: EmojiName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}

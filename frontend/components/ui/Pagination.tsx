'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** «Página 2 · 51 documentos» with previous and next; the backend paginates with next/previous links. */
export function Pagination({ label, summary, hasPrevious, hasNext, busy = false, onPrevious, onNext, previousLabel, nextLabel }: PaginationProps) {
  const t = useTranslations('ui');

  return (
    <nav aria-label={label} className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <p className="text-[13px] font-medium text-ink-2">{summary}</p>
      <div className="flex gap-2">
        <button aria-label={previousLabel ?? t('previous')} className={PAGER} disabled={!hasPrevious || busy} onClick={onPrevious} type="button">
          <ChevronLeft aria-hidden className="size-4" />
          <span className="hidden sm:inline">{previousLabel ?? t('previous')}</span>
        </button>
        <button aria-label={nextLabel ?? t('next')} className={PAGER} disabled={!hasNext || busy} onClick={onNext} type="button">
          <span className="hidden sm:inline">{nextLabel ?? t('next')}</span>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
    </nav>
  );
}

const PAGER =
  'inline-flex h-10 items-center gap-1 rounded-full bg-surface px-3 text-sm font-semibold text-ink shadow-rest transition hover:shadow-float active:scale-[0.97] disabled:pointer-events-none disabled:bg-surface-sunk disabled:text-ink-3 disabled:shadow-none sm:px-4';

interface PaginationProps {
  label: string;
  summary: string;
  hasPrevious: boolean;
  hasNext: boolean;
  busy?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel?: string;
  nextLabel?: string;
}

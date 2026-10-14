import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * A state reads, it is not guessed: tint background, its 700 text on top and a dot of the solid color, so the color
 * never goes alone. Sizes: sm for tables, md elsewhere, lg (32 px) for headers.
 */
export function Badge({ tone = 'neutral', size = 'md', dot = true, className, children }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold', BADGE_SIZE[size], BADGE_TONE[tone].box, className)}>
      {dot ? <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', BADGE_TONE[tone].dot)} /> : null}
      {children}
    </span>
  );
}

/** A small count bubble, e.g. next to «Alertas» in the menu. */
export function CountBubble({ count, tone = 'danger', label }: { count: number; tone?: BadgeTone; label?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={label}
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums',
        tone === 'danger' ? 'bg-danger text-white dark:text-[#15131F]' : BADGE_TONE[tone].box,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

const BADGE_SIZE = {
  sm: 'h-6 px-2.5 text-[12px]',
  md: 'h-7 px-3 text-[13px]',
  lg: 'h-8 px-3.5 text-[13px]',
} as const;

export const BADGE_TONE = {
  neutral: { box: 'bg-neutral-bg text-neutral-fg', dot: 'bg-ink-3' },
  primary: { box: 'bg-primary-soft text-primary-text', dot: 'bg-primary' },
  success: { box: 'bg-success-bg text-success-fg', dot: 'bg-success' },
  info: { box: 'bg-info-bg text-info-fg', dot: 'bg-info' },
  pending: { box: 'bg-pending-bg text-pending-fg', dot: 'bg-pending' },
  warning: { box: 'bg-warning-bg text-warning-fg', dot: 'bg-warning' },
  danger: { box: 'bg-danger-bg text-danger-fg', dot: 'bg-danger' },
} as const;

export type BadgeTone = keyof typeof BADGE_TONE;

interface BadgeProps {
  tone?: BadgeTone;
  size?: keyof typeof BADGE_SIZE;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

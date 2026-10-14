import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** A rail filled with the Boreal aurora; amber or rose when the share is a warning (e.g. a range almost used up). */
export function ProgressBar({ value, label, tone = 'aurora', className }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <div
      aria-label={typeof label === 'string' ? label : undefined}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-sunk shadow-sunk', className)}
      role="progressbar"
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-soft', FILL[tone])} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** The tone of a usage share: calm, then amber from 80 %, rose from 90 %. */
export function usageTone(share: number): ProgressTone {
  if (share >= 0.9) return 'danger';
  if (share >= 0.8) return 'warning';
  return 'aurora';
}

const FILL = {
  aurora: 'aurora-progress',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

type ProgressTone = keyof typeof FILL;

interface ProgressBarProps {
  value: number;
  label?: ReactNode;
  tone?: ProgressTone;
  className?: string;
}

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** An in-page notice: tint of its family, a bold first sentence, the rest in normal weight, an action on the right. */
export function Notice({ tone = 'info', title, children, action, className }: NoticeProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-[15px] shadow-[inset_0_0_0_1px_var(--line)]', NOTICE_TONE[tone], className)}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    >
      <p className="min-w-0 flex-1">
        {title ? <strong className="font-bold">{title} </strong> : null}
        <span>{children}</span>
      </p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const NOTICE_TONE = {
  info: 'bg-info-bg text-info-fg',
  success: 'bg-success-bg text-success-fg',
  pending: 'bg-pending-bg text-pending-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  neutral: 'bg-neutral-bg text-neutral-fg',
} as const;

interface NoticeProps {
  tone?: keyof typeof NOTICE_TONE;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

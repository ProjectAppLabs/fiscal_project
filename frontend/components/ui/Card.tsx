import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Radius 22, padding 24, resting relief. The default level of every surface. */
export function Card({ as: Tag = 'section', className, children, ...props }: CardProps) {
  return (
    <Tag className={cn('rounded-card bg-surface p-5 shadow-rest sm:p-6', className)} {...props}>
      {children}
    </Tag>
  );
}

/** Card title (Title 3) with an optional subtitle and an action on the right. */
export function CardHeader({ id, title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-bold leading-6 text-ink" id={id}>
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-[13px] font-medium text-ink-3">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Label/value rows: two columns on wide screens, stacked on narrow ones. */
export function DataList({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(8rem,auto)_1fr]', className)}>{children}</dl>;
}

export function DataItem({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="contents" role="group" aria-label={typeof label === 'string' ? label : undefined}>
      <dt className="text-[13px] font-medium text-ink-3 sm:pt-px">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] text-ink">{children}</dd>
    </div>
  );
}

/** A big figure with its caption, for dashboards. */
export function Figure({ value, caption, className }: { value: ReactNode; caption: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <span className="text-[40px] font-extrabold leading-[44px] tracking-[-0.03em] tabular-nums text-ink">{value}</span>
      <span className="text-[15px] text-ink-2">{caption}</span>
    </div>
  );
}

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article';
}

interface CardHeaderProps {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

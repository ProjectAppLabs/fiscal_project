import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Emoji, type EmojiName } from './Emoji';

/**
 * The issuer's life cycle (H-09): done in mint, the current one in lavender with a ring and shadow, pending ones
 * sunk and desaturated, a problem in rose. The rail fills with the Boreal aurora up to the current step.
 */
export function Lifecycle({ label, steps }: { label: string; steps: LifecycleStep[] }) {
  const reached = Math.max(0, steps.findIndex((step) => step.state !== 'done'));
  const progress = steps.every((step) => step.state === 'done') ? 1 : reached / Math.max(1, steps.length - 1);

  return (
    <ol aria-label={label} className="relative grid gap-4 sm:grid-cols-[repeat(var(--steps),minmax(0,1fr))]" style={{ '--steps': steps.length } as React.CSSProperties}>
      <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-1.5 rounded-full bg-surface-sunk sm:block">
        <span className="aurora-progress block h-full rounded-full transition-[width] duration-700 ease-soft" style={{ width: `${progress * 100}%` }} />
      </span>
      {steps.map((step) => (
        <li aria-current={step.state === 'current' ? 'step' : undefined} className="relative flex items-center gap-3 sm:flex-col sm:text-center" key={step.key}>
          <span
            className={cn(
              'grid size-14 shrink-0 place-items-center rounded-lg transition',
              step.state === 'done' && 'bg-success-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.85)]',
              step.state === 'current' && 'bg-primary-soft shadow-[0_0_0_3px_var(--focus),0_12px_24px_-12px_var(--primary)]',
              step.state === 'pending' && 'bg-surface-sunk opacity-70 shadow-sunk grayscale',
              step.state === 'problem' && 'bg-danger-bg shadow-[0_0_0_3px_var(--danger)]',
            )}
          >
            <Emoji name={step.emoji} size={32} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-ink">{step.title}</span>
            <span className={cn('block text-[13px] font-semibold', STATE_TEXT[step.state])}>{step.caption}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The enrolment wizard's steps: done in mint with a check (and clickable), the current raised with a lavender ring,
 * the next ones sunk.
 */
export function Stepper({ label, steps, current, onStepClick }: StepperProps) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const content = (
          <>
            <span className={cn('grid size-5 place-items-center rounded-full text-[11px] font-bold', done ? 'bg-success text-white dark:text-[#15131F]' : active ? 'bg-primary text-primary-ink' : 'bg-surface text-ink-3')}>
              {done ? <Check aria-hidden className="size-3" /> : index + 1}
            </span>
            {step}
          </>
        );
        const className = cn(
          'inline-flex h-9 items-center gap-2 rounded-full pl-2 pr-4 text-[13px] font-semibold',
          done && 'bg-success-bg text-success-fg',
          active && 'bg-surface text-ink shadow-[0_0_0_2px_var(--focus),var(--shadow-rest)]',
          !done && !active && 'bg-surface-sunk text-ink-3 shadow-sunk',
        );
        return (
          <li aria-current={active ? 'step' : undefined} key={step}>
            {done && onStepClick ? (
              <button className={cn(className, 'transition hover:brightness-[0.97] active:scale-[0.97]')} onClick={() => onStepClick(index)} type="button">
                {content}
              </button>
            ) : (
              <span className={className}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** ✓ green / ✗ rose requirement rows, with an optional action at the end of a row. */
export function RequirementList({ items, className }: { items: Requirement[]; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {items.map((item) => (
        <li className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3', item.ok ? 'bg-success-bg/70' : 'bg-surface-sunk/70')} key={item.key}>
          <span className="flex min-w-0 items-start gap-3">
            <span aria-hidden className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold', item.ok ? 'bg-success text-white dark:text-[#15131F]' : 'bg-surface text-ink-3 shadow-sunk')}>
              {item.ok ? '✓' : ''}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-[15px] font-semibold', item.ok ? 'text-success-fg' : 'text-ink')}>
                <span className="sr-only">{item.ok ? '✓ ' : '✗ '}</span>
                {item.label}
              </span>
              {item.detail ? <span className="block text-[13px] text-ink-3">{item.detail}</span> : null}
            </span>
          </span>
          {item.action ? <span className="shrink-0">{item.action}</span> : null}
        </li>
      ))}
    </ul>
  );
}

const STATE_TEXT = {
  done: 'text-success-fg',
  current: 'text-primary-text',
  pending: 'text-ink-3',
  problem: 'text-danger-fg',
} as const;

export interface LifecycleStep {
  key: string;
  emoji: EmojiName;
  title: string;
  caption: string;
  state: keyof typeof STATE_TEXT;
}

export interface Requirement {
  key: string;
  label: string;
  ok: boolean;
  detail?: ReactNode;
  action?: ReactNode;
}

interface StepperProps {
  label: string;
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
}

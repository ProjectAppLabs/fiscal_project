'use client';

import type { KeyboardEvent, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * A sunk rail with the active tab raised (WAI-ARIA tabs: arrows move, Home/End jump). The parent owns the value,
 * so it can keep it in the URL (?tab=…) for shareable links.
 */
export function Tabs<Value extends string>({ label, tabs, value, onChange, className }: TabsProps<Value>) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = tabs[(moves[event.key] + tabs.length) % tabs.length];
    onChange(next.value);
    document.getElementById(`tab-${next.value}`)?.focus();
  };

  return (
    <div
      aria-label={label}
      className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-sunk p-1 shadow-sunk', className)}
      onKeyDown={onKeyDown}
      role="tablist"
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            aria-controls={`panel-${tab.value}`}
            aria-selected={selected}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition duration-200 ease-soft',
              selected ? 'bg-surface text-ink shadow-rest' : 'text-ink-2 hover:text-ink',
            )}
            id={`tab-${tab.value}`}
            key={tab.value}
            onClick={() => onChange(tab.value)}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <div aria-labelledby={`tab-${value}`} className="appear" id={`panel-${value}`} role="tabpanel">
      {children}
    </div>
  );
}

interface TabsProps<Value extends string> {
  label: string;
  tabs: { value: Value; label: ReactNode; badge?: ReactNode }[];
  value: Value;
  onChange: (value: Value) => void;
  className?: string;
}

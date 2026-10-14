'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/cn';

/** Copies a value; says «Copiado» for 2 s. */
export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const t = useTranslations('ui');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      aria-label={label ?? t('copy')}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition active:scale-[0.97]',
        copied ? 'bg-success-bg text-success-fg' : 'bg-primary-soft text-primary-text hover:brightness-[0.97]',
        className,
      )}
      onClick={() => void onCopy()}
      type="button"
    >
      {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
      <span aria-live="polite">{copied ? t('copied') : t('copy')}</span>
    </button>
  );
}

/** A long fiscal code (CUFE, keys) in mono, truncated in the middle on narrow screens, with its copy button. */
export function CodeValue({ value, label }: { value: string; label?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-sm bg-surface-sunk/70 py-1 pl-3 pr-1">
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink" title={value}>
        {value}
      </span>
      <CopyButton label={label} value={value} />
    </span>
  );
}

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Bot, Copy, Download } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/constants';
import { handoffGuide, loadHandoff, type HandoffContext, type HandoffId } from '@/lib/handoff';
import { saveBlob } from '@/lib/services/operations';

/**
 * «Do it with Claude in Chrome»: the guide of this step, ready to paste into the extension with the console address and
 * the issuer filled in. The person still signs in and types every secret; the guide says so to Claude.
 */
export function HandoffCard({ guides, issuer, className }: { guides: HandoffId[]; issuer?: HandoffContext['issuer']; className?: string }) {
  const t = useTranslations('handoff');

  return (
    <aside aria-label={t('title')} className={cn('rounded-lg bg-primary-soft/40 px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--line)]', className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-primary-text shadow-rest">
          <Bot aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{t('title')}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{t('body')}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {guides.map((id) => (
              <HandoffRow id={id} issuer={issuer} key={id} />
            ))}
          </ul>
          <Link className="mt-3 inline-block text-[13px] font-semibold text-primary-text hover:underline" href={ROUTES.HELP}>
            {t('allGuides')}
          </Link>
        </div>
      </div>
    </aside>
  );
}

/** One guide with its two ways out: the clipboard (to paste in Claude) or a .md file (to keep or send). */
export function HandoffRow({ id, issuer }: { id: HandoffId; issuer?: HandoffContext['issuer'] }) {
  const t = useTranslations('handoff');
  const [busy, setBusy] = useState<'copy' | 'download' | null>(null);
  const title = t(`guides.${id}.title`);

  const run = async (kind: 'copy' | 'download') => {
    setBusy(kind);
    try {
      const text = await loadHandoff(id, { origin: window.location.origin, issuer }, t('noIssuer'));
      if (kind === 'copy') {
        await navigator.clipboard.writeText(text);
        toast(t('copied', { title }));
      } else {
        saveBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), handoffGuide(id).file);
      }
    } catch {
      toast(kind === 'copy' ? t('copyFailed') : t('downloadFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-surface/80 px-3 py-2">
      <span className="min-w-0 text-[13px] font-medium text-ink">{title}</span>
      <span className="flex gap-1.5">
        <Button aria-label={`${t('copy')}: ${title}`} icon={<Copy aria-hidden className="size-3.5" />} loading={busy === 'copy'} onClick={() => void run('copy')} size="sm" variant="soft">
          {t('copy')}
        </Button>
        <Button aria-label={`${t('download')}: ${title}`} icon={<Download aria-hidden className="size-3.5" />} loading={busy === 'download'} onClick={() => void run('download')} size="sm" variant="ghost">
          {t('download')}
        </Button>
      </span>
    </li>
  );
}

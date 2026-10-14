'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink, ShieldAlert } from 'lucide-react';

import { InfoTip } from '@/components/ui/InfoTip';
import type messages from '@/messages/es.json';

type Tips = (typeof messages)['help']['tips'];
/** «group.field», for example «software.pin»: a typo fails the typecheck. */
export type HelpTopic = { [Group in keyof Tips]: `${Group & string}.${keyof Tips[Group] & string}` }[keyof Tips];

/**
 * The help of one field or step, from `help.<topic>` in the messages: what it is, where it comes from (a portal, the
 * RUT, the certificate entity…) and, for secrets, who types it. `link` adds the page where the data is.
 */
export function HelpTip({ topic, label, className }: { topic: HelpTopic; label: string; className?: string }) {
  const t = useTranslations('help');
  const tips = useTranslations('help.tips');
  // Not every topic has every part (where, secret, link), so the parts are looked up by plain string.
  const has = (part: string) => tips.has(`${topic}.${part}` as never);
  const tTips = (key: string) => tips(key as never);

  return (
    <InfoTip className={className} label={label}>
      <span className="block font-semibold text-ink">{t('what')}</span>
      <span className="mt-0.5 block">{tTips(`${topic}.what`)}</span>
      {has('where') ? (
        <>
          <span className="mt-3 block font-semibold text-ink">{t('where')}</span>
          <span className="mt-0.5 block">{tTips(`${topic}.where`)}</span>
        </>
      ) : null}
      {has('secret') ? (
        <span className="mt-3 flex gap-2 rounded-sm bg-warning-bg px-3 py-2 text-warning-fg">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{tTips(`${topic}.secret`)}</span>
        </span>
      ) : null}
      {has('link') ? (
        <a
          className="mt-3 inline-flex items-center gap-1 font-semibold text-primary-text hover:underline"
          href={tTips(`${topic}.link`)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {has('linkLabel') ? tTips(`${topic}.linkLabel`) : t('openPage')}
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      ) : null}
    </InfoTip>
  );
}

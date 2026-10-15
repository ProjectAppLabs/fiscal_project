'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, CircleHelp, ShieldAlert } from 'lucide-react';

import { HandoffRow } from '@/components/console/HandoffCard';
import { Page } from '@/components/layout/Page';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { ROUTES } from '@/lib/constants';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { HANDOFF_GUIDES } from '@/lib/handoff';

const GROUPS = ['dian', 'fiscal'] as const;
const HOW_STEPS = ['1', '2', '3', '4'] as const;

/**
 * Every guide in one place: how to hand a process to Claude in Chrome without handing it a secret, and each guide to
 * copy or download. The guides are the same .md files the steps offer.
 */
export default function HelpPage() {
  const t = useTranslations('helpPage');
  const tGuides = useTranslations('handoff.guides');
  const { isAuthenticated } = useRequireAuth();

  if (!isAuthenticated) return null;

  return (
    <Page>
      <PageHeader emoji="search" subtitle={t('subtitle')} title={t('title')} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex flex-col gap-4">
          {GROUPS.map((group) => (
            <Card aria-labelledby={`help-${group}`} key={group}>
              <CardHeader id={`help-${group}`} title={t(`groups.${group}`)} />
              <ul className="flex flex-col gap-3">
                {HANDOFF_GUIDES.filter((guide) => guide.group === group).map((guide) => (
                  <li className="flex flex-col gap-1.5" key={guide.id}>
                    <ul>
                      <HandoffRow id={guide.id} />
                    </ul>
                    <p className="px-3 text-[13px] text-ink-3">{tGuides(`${guide.id}.description`)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <Card aria-labelledby="help-api">
            <CardHeader id="help-api" subtitle={t('apiSubtitle')} title={t('apiTitle')} />
            <ButtonLink href={ROUTES.API_DOCS} icon={<BookOpen aria-hidden className="size-4" />} variant="primary">
              {t('apiOpen')}
            </ButtonLink>
          </Card>
          <Card aria-labelledby="help-how">
            <CardHeader id="help-how" title={t('howTitle')} />
            <ol className="flex flex-col gap-3">
              {HOW_STEPS.map((step) => (
                <li className="flex gap-3 text-[15px] text-ink-2" key={step}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold text-primary-text">{step}</span>
                  <span>{t(`howSteps.${step}`)}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Notice tone="warning" title={t('safetyTitle')}>
            <ShieldAlert aria-hidden className="mr-1 inline size-4 align-[-3px]" />
            {t('safetyBody')}
          </Notice>
          <Card aria-labelledby="help-tips">
            <CardHeader id="help-tips" title={t('tipsTitle')} />
            <p className="text-[15px] text-ink-2">
              <CircleHelp aria-hidden className="mr-1 inline size-4 align-[-3px] text-primary-text" />
              {t('tipsBody')}
            </p>
          </Card>
        </div>
      </div>
    </Page>
  );
}

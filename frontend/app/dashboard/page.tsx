'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ConsoleLoadError, STATE_TONE } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge, BADGE_TONE } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, Figure } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { ROUTES, documentDetailRoute } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { DOCUMENT_STATES, describeDianError, type ConsoleSummary } from '@/lib/services/console';
import { useAuthStore } from '@/lib/stores/authStore';
import { useConsoleStore, type LoadStatus } from '@/lib/stores/consoleStore';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const { isAuthenticated } = useRequireAuth();
  const user = useAuthStore((s) => s.user);
  const summary = useConsoleStore((s) => s.summary);
  const summaryStatus = useConsoleStore((s) => s.summaryStatus);
  const loadSummary = useConsoleStore((s) => s.loadSummary);

  useEffect(() => {
    if (isAuthenticated) void loadSummary();
  }, [isAuthenticated, loadSummary]);

  if (!isAuthenticated) return null;

  return (
    <Page>
      <PageHeader
        actions={
          <ButtonLink href={ROUTES.DOCUMENTS} variant="secondary">
            {t('viewAll')}
          </ButtonLink>
        }
        emoji="dashboard"
        subtitle={user?.first_name ? t('greeting', { name: user.first_name, today: formatDate(new Date().toISOString(), locale) }) : t('subtitle')}
        title={t('title')}
      />
      <DashboardBody onRetry={() => void loadSummary()} status={summaryStatus} summary={summary} />
    </Page>
  );
}

function DashboardBody({ status, summary, onRetry }: { status: LoadStatus; summary: ConsoleSummary | null; onRetry: () => void }) {
  const t = useTranslations('dashboard');

  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={onRetry} />;
  if (!summary) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonCard className="md:col-span-3" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const inContingency = summary.health.dian.in_contingency;
  return (
    <div className="appear flex flex-col gap-4">
      {summary.alerts.critical ? (
        <Notice
          action={
            <ButtonLink href={ROUTES.ALERTS} size="sm" variant="danger">
              {t('viewAlerts')}
            </ButtonLink>
          }
          title={t('criticalNotice', { count: summary.alerts.critical })}
          tone="danger"
        >
          {t('criticalNoticeBody')}
        </Notice>
      ) : null}
      {inContingency ? (
        <Notice
          action={
            <ButtonLink href={ROUTES.CONTINGENCIES} size="sm" variant="secondary">
              {t('viewContingencies')}
            </ButtonLink>
          }
          title={t('contingencyNotice', { count: inContingency })}
          tone="warning"
        >
          {t('contingencyNoticeBody')}
        </Notice>
      ) : null}

      {summary.documents.total === 0 ? (
        <div data-testid="dashboard-empty-state">
          <EmptyState
            action={
              <ButtonLink href={ROUTES.CLIENT_SYSTEMS} size="sm" variant="secondary">
                {t('viewClientSystems')}
              </ButtonLink>
            }
            body={t('emptyBody')}
            title={t('emptyTitle')}
          />
        </div>
      ) : (
        <DocumentCounters summary={summary} />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <QueueCard queue={summary.queue} />
        <AlertsCard summary={summary} />
        <HealthCard summary={summary} />
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <SetupCard summary={summary} />
        {summary.last_rejection ? <LastRejection rejection={summary.last_rejection} /> : null}
      </div>
    </div>
  );
}

function DocumentCounters({ summary }: { summary: ConsoleSummary }) {
  const t = useTranslations('dashboard');
  const tStates = useTranslations('console.states');
  const locale = useLocale();

  return (
    <Card aria-labelledby="dashboard-documents">
      <CardHeader
        action={
          <span className="text-[15px] text-ink-2">
            {t.rich('totalCaption', { count: formatNumber(summary.documents.total, locale), strong: (chunks) => <strong className="font-bold text-ink">{chunks}</strong> })}
          </span>
        }
        id="dashboard-documents"
        title={t('documentsTitle')}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <CounterTile label={t('total')} value={summary.documents.total} />
        {DOCUMENT_STATES.map((state) => (
          <CounterTile
            dotClass={BADGE_TONE[STATE_TONE[state]].dot}
            href={`${ROUTES.DOCUMENTS}?state=${state}`}
            key={state}
            label={tStates(state)}
            value={summary.documents.by_state[state] ?? 0}
          />
        ))}
      </div>
    </Card>
  );
}

function QueueCard({ queue }: { queue: ConsoleSummary['queue'] }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  return (
    <Card aria-labelledby="dashboard-queue" className="flex flex-col">
      <CardHeader id="dashboard-queue" title={t('queueTitle')} />
      <div role="group" aria-label={t('queueDue')}>
        <Figure caption={t('queueDueCaption')} value={formatNumber(queue.due, locale)} />
      </div>
      <div className="mt-3" role="group" aria-label={t('queueOldest')}>
        <Badge tone={queue.oldest_queued_at ? 'pending' : 'neutral'}>
          {t('queueOldest')}: {formatDateTime(queue.oldest_queued_at, locale)}
        </Badge>
      </div>
      <CardLink href={`${ROUTES.DOCUMENTS}?state=queued`}>{t('viewQueue')}</CardLink>
    </Card>
  );
}

function AlertsCard({ summary }: { summary: ConsoleSummary }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const rate = summary.rejection_rate_24h;

  return (
    <Card aria-labelledby="dashboard-alerts" className="flex flex-col">
      <CardHeader id="dashboard-alerts" title={t('alertsTitle')} />
      <div role="group" aria-label={t('alertsTitle')}>
        <Figure caption={t('alertsCaption')} value={formatNumber(summary.alerts.total, locale)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={summary.alerts.critical ? 'danger' : 'neutral'}>{t('alertsCritical', { count: summary.alerts.critical })}</Badge>
        <span role="group" aria-label={t('rejectionRate')}>
          <Badge dot={false} tone="neutral">
            {t('rejectionRate')}: {rate === null ? '—' : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(rate)}
          </Badge>
        </span>
      </div>
      {rate === null ? <p className="mt-2 text-[13px] text-ink-3">{t('rejectionRateNone')}</p> : null}
      <CardLink href={ROUTES.ALERTS}>{t('viewAlerts')}</CardLink>
    </Card>
  );
}

function HealthCard({ summary }: { summary: ConsoleSummary }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const { health } = summary;

  return (
    <Card aria-labelledby="dashboard-health">
      <CardHeader id="dashboard-health" title={t('healthTitle')} />
      <ul className="flex flex-col gap-2">
        <HealthRow label={t('service')} ok={health.status === 'ok'} value={t(`healthStatus.${health.status}`)} />
        <HealthRow
          detail={health.worker.last_beat_at ? t('lastBeat', { when: formatRelative(health.worker.last_beat_at, locale) }) : undefined}
          label={t('worker')}
          ok={health.worker.ok}
          value={health.worker.ok ? t('workerOk') : t('workerSilent')}
        />
        <HealthRow label={t('contingencies')} ok={!health.dian.in_contingency} value={t('dianContingency', { count: health.dian.in_contingency })} />
      </ul>
      <span className="mt-auto flex flex-wrap gap-x-4">
        <CardLink href={ROUTES.HEALTH}>{t('viewHealth')}</CardLink>
        <CardLink href={ROUTES.CONTINGENCIES}>{t('viewContingencies')}</CardLink>
      </span>
    </Card>
  );
}

function HealthRow({ label, value, detail, ok }: { label: string; value: string; detail?: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-surface-sunk/60 px-4 py-2.5">
      <span className="text-[15px] font-medium text-ink">{label}</span>
      <span className="text-right">
        <span className={cn('block text-[13px] font-bold', ok ? 'text-success-fg' : 'text-danger-fg')}>{value}</span>
        {detail ? <span className="block text-[12px] text-ink-3">{detail}</span> : null}
      </span>
    </li>
  );
}

function SetupCard({ summary }: { summary: ConsoleSummary }) {
  const t = useTranslations('dashboard');

  return (
    <Card aria-labelledby="dashboard-setup">
      <CardHeader id="dashboard-setup" title={t('setupTitle')} />
      <div className="grid grid-cols-2 gap-3">
        <CounterTile href={ROUTES.ISSUERS} label={t('issuers')} value={summary.issuers} />
        <CounterTile href={ROUTES.CLIENT_SYSTEMS} label={t('clientSystems')} value={summary.client_systems} />
      </div>
    </Card>
  );
}

function LastRejection({ rejection }: { rejection: NonNullable<ConsoleSummary['last_rejection']> }) {
  const t = useTranslations('dashboard');
  const tConsole = useTranslations('console');
  const locale = useLocale();
  const firstError = rejection.errors[0];

  return (
    <Card aria-labelledby="dashboard-last-rejection">
      <CardHeader
        id="dashboard-last-rejection"
        subtitle={`${t('lastRejectionAt', { date: formatDateTime(rejection.at, locale) })} · ${tConsole('issuer', { name: rejection.issuer.legal_name, nit: rejection.issuer.nit })}`}
        title={t('lastRejectionTitle')}
      />
      {firstError ? <p className="rounded-lg bg-danger-bg px-4 py-3 font-mono text-[13px] text-danger-fg">{describeDianError(firstError)}</p> : null}
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-[13px] font-medium text-ink">{rejection.full_number}</span>
        <Link className="font-semibold text-primary-text hover:underline" href={documentDetailRoute(rejection.id)}>
          {t('viewDocument')}
        </Link>
      </p>
    </Card>
  );
}

function CounterTile({ label, value, href, dotClass }: { label: string; value: number; href?: string; dotClass?: string }) {
  const locale = useLocale();
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
        {dotClass ? <span aria-hidden className={cn('size-2 rounded-full', dotClass)} /> : null}
        {label}
      </span>
      <span className="mt-1 block text-[28px] font-extrabold leading-8 tracking-[-0.02em] tabular-nums text-ink">{formatNumber(value, locale)}</span>
    </>
  );
  const className = 'block rounded-lg bg-surface-sunk/60 px-4 py-3';

  return href ? (
    <div aria-label={label} role="group">
      <Link className={cn(className, 'transition hover:bg-primary-soft/60')} href={href}>
        {body}
      </Link>
    </div>
  ) : (
    <div aria-label={label} className={className} role="group">
      {body}
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primary-text hover:underline" href={href}>
      {children} <span aria-hidden>→</span>
    </Link>
  );
}

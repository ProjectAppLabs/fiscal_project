'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { FiscalLogo } from '@/components/brand/FiscalLogo';
import { ConsoleLoadError, ConsoleLoading } from '@/components/console/ConsoleStatus';
import { ROUTES, documentDetailRoute } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { DOCUMENT_STATES, describeDianError, type ConsoleSummary } from '@/lib/services/console';
import { useConsoleStore, type LoadStatus } from '@/lib/stores/consoleStore';

const CARD_CLASS = 'rounded-2xl border border-border bg-card p-6';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { isAuthenticated } = useRequireAuth();
  const summary = useConsoleStore((s) => s.summary);
  const summaryStatus = useConsoleStore((s) => s.summaryStatus);
  const loadSummary = useConsoleStore((s) => s.loadSummary);

  useEffect(() => {
    if (isAuthenticated) void loadSummary();
  }, [isAuthenticated, loadSummary]);

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-4xl">
        <FiscalLogo />
      </h1>
      <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>

      <DashboardBody status={summaryStatus} summary={summary} onRetry={() => void loadSummary()} />
    </main>
  );
}

function DashboardBody({
  status,
  summary,
  onRetry,
}: {
  status: LoadStatus;
  summary: ConsoleSummary | null;
  onRetry: () => void;
}) {
  const t = useTranslations('dashboard');

  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={onRetry} />;
  if (!summary) return <ConsoleLoading />;

  return (
    <div className="mt-10 space-y-6">
      {summary.documents.total === 0 ? <EmptyState /> : <DocumentCounters summary={summary} />}

      <div className="grid gap-6 md:grid-cols-2">
        <section className={CARD_CLASS} aria-labelledby="dashboard-setup">
          <h2 className="text-lg font-semibold" id="dashboard-setup">
            {t('setupTitle')}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <Counter label={t('issuers')} value={summary.issuers} />
            <Counter label={t('clientSystems')} value={summary.client_systems} />
          </dl>
        </section>

        <QueueCard queue={summary.queue} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <AlertsCard summary={summary} />
        <HealthCard summary={summary} />
      </div>

      {summary.last_rejection ? <LastRejection rejection={summary.last_rejection} /> : null}
    </div>
  );
}

function EmptyState() {
  const t = useTranslations('dashboard');

  return (
    <section
      className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center"
      data-testid="dashboard-empty-state"
    >
      <h2 className="text-lg font-semibold">{t('emptyTitle')}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
    </section>
  );
}

function DocumentCounters({ summary }: { summary: ConsoleSummary }) {
  const t = useTranslations('dashboard');
  const tStates = useTranslations('console.states');

  return (
    <section className={CARD_CLASS} aria-labelledby="dashboard-documents">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" id="dashboard-documents">
          {t('documentsTitle')}
        </h2>
        <Link className="text-sm hover:underline" href={ROUTES.DOCUMENTS}>
          {t('viewAll')}
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <Counter label={t('total')} value={summary.documents.total} />
        {DOCUMENT_STATES.map((state) => (
          <Counter key={state} label={tStates(state)} value={summary.documents.by_state[state] ?? 0} />
        ))}
      </dl>
    </section>
  );
}

function QueueCard({ queue }: { queue: ConsoleSummary['queue'] }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  return (
    <section className={CARD_CLASS} aria-labelledby="dashboard-queue">
      <h2 className="text-lg font-semibold" id="dashboard-queue">
        {t('queueTitle')}
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <Counter label={t('queueDue')} value={queue.due} />
        <Counter label={t('queueOldest')} value={formatDateTime(queue.oldest_queued_at, locale)} />
      </dl>
    </section>
  );
}

function AlertsCard({ summary }: { summary: ConsoleSummary }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const rate = summary.rejection_rate_24h;

  return (
    <section className={CARD_CLASS} aria-labelledby="dashboard-alerts">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" id="dashboard-alerts">
          {t('alertsTitle')}
        </h2>
        <Link className="text-sm hover:underline" href={ROUTES.ALERTS}>
          {t('viewAlerts')}
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <Counter label={t('alertsTitle')} value={summary.alerts.total} />
        <Counter
          label={t('rejectionRate')}
          value={rate === null ? '—' : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(rate)}
        />
      </dl>
      <p className={`mt-3 text-sm ${summary.alerts.critical ? 'text-destructive' : 'text-muted-foreground'}`}>
        {t('alertsCritical', { count: summary.alerts.critical })}
      </p>
      {rate === null ? <p className="mt-1 text-xs text-muted-foreground">{t('rejectionRateNone')}</p> : null}
    </section>
  );
}

function HealthCard({ summary }: { summary: ConsoleSummary }) {
  const t = useTranslations('dashboard');
  const { health } = summary;
  const tone = health.status === 'ok' ? 'text-success' : 'text-destructive';

  return (
    <section className={CARD_CLASS} aria-labelledby="dashboard-health">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" id="dashboard-health">
          {t('healthTitle')}
        </h2>
        <Link className="text-sm hover:underline" href={ROUTES.CONTINGENCIES}>
          {t('viewContingencies')}
        </Link>
      </div>
      <p className={`mt-3 text-base font-semibold ${tone}`}>{t(`healthStatus.${health.status}`)}</p>
      <ul className="mt-2 space-y-1 text-sm">
        <li className={health.worker.ok ? '' : 'text-destructive'}>{health.worker.ok ? t('workerOk') : t('workerSilent')}</li>
        <li className={health.dian.in_contingency ? 'text-destructive' : ''}>
          {t('dianContingency', { count: health.dian.in_contingency })}
        </li>
      </ul>
    </section>
  );
}

function LastRejection({ rejection }: { rejection: NonNullable<ConsoleSummary['last_rejection']> }) {
  const t = useTranslations('dashboard');
  const tConsole = useTranslations('console');
  const locale = useLocale();
  const firstError = rejection.errors[0];

  return (
    <section className={CARD_CLASS} aria-labelledby="dashboard-last-rejection">
      <h2 className="text-lg font-semibold" id="dashboard-last-rejection">
        {t('lastRejectionTitle')}
      </h2>
      <p className="mt-3 font-mono text-base">{rejection.full_number}</p>
      <p className="mt-1 text-sm">
        {tConsole('issuer', { name: rejection.issuer.legal_name, nit: rejection.issuer.nit })}
      </p>
      {firstError ? <p className="mt-2 text-sm text-destructive">{describeDianError(firstError)}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {t('lastRejectionAt', { date: formatDateTime(rejection.at, locale) })}
      </p>
      <Link className="mt-3 inline-block text-sm hover:underline" href={documentDetailRoute(rejection.id)}>
        {t('viewDocument')}
      </Link>
    </section>
  );
}

function Counter({ label, value }: { label: string; value: number | string }) {
  return (
    <div role="group" aria-label={label}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

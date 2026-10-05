'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { ConsoleLoadError, ConsoleLoading } from '@/components/console/ConsoleStatus';
import { documentDetailRoute, issuerDetailRoute } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { isAlertKind, type Alert } from '@/lib/services/operations';
import { useOperationsStore } from '@/lib/stores/operationsStore';

const PAGER_BUTTON_CLASS =
  'rounded-full border border-border px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const SEVERITY_TONE = {
  critical: 'bg-destructive/15 text-foreground',
  warning: 'bg-warning/15 text-foreground',
} as const;

export default function AlertsPage() {
  const t = useTranslations('alerts');
  const { isAuthenticated } = useRequireAuth();
  const includeResolved = useOperationsStore((s) => s.includeResolved);
  const loadAlerts = useOperationsStore((s) => s.loadAlerts);
  const showResolvedAlerts = useOperationsStore((s) => s.showResolvedAlerts);

  useEffect(() => {
    if (isAuthenticated) void loadAlerts();
  }, [isAuthenticated, loadAlerts]);

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <label className="mt-6 inline-flex items-center gap-2 text-sm">
        <input checked={includeResolved} onChange={(e) => void showResolvedAlerts(e.target.checked)} type="checkbox" />
        {t('showResolved')}
      </label>
      <AlertResults />
    </main>
  );
}

function AlertResults() {
  const t = useTranslations('alerts');
  const alerts = useOperationsStore((s) => s.alerts);
  const status = useOperationsStore((s) => s.alertsStatus);
  const page = useOperationsStore((s) => s.alertsPage);
  const includeResolved = useOperationsStore((s) => s.includeResolved);
  const loadAlerts = useOperationsStore((s) => s.loadAlerts);
  const goToAlertsPage = useOperationsStore((s) => s.goToAlertsPage);

  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={() => void loadAlerts()} />;
  if (!alerts) return <ConsoleLoading />;
  if (alerts.results.length === 0) {
    return (
      <p className="mt-10 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm">
        {includeResolved ? t('emptyAll') : t('empty')}
      </p>
    );
  }

  return (
    <>
      <AlertTable alerts={alerts.results} />
      <nav aria-label={t('pagination')} className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t('pageInfo', { page, count: alerts.count })}</p>
        <div className="flex gap-2">
          <button
            className={PAGER_BUTTON_CLASS}
            disabled={!alerts.previous || status === 'loading'}
            onClick={() => void goToAlertsPage(alerts.previous)}
            type="button"
          >
            {t('previous')}
          </button>
          <button
            className={PAGER_BUTTON_CLASS}
            disabled={!alerts.next || status === 'loading'}
            onClick={() => void goToAlertsPage(alerts.next)}
            type="button"
          >
            {t('next')}
          </button>
        </div>
      </nav>
    </>
  );
}

function AlertTable({ alerts }: { alerts: Alert[] }) {
  const t = useTranslations('alerts');
  const tSeverities = useTranslations('operations.severities');
  const tKinds = useTranslations('operations.alertKinds');
  const locale = useLocale();

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t('tableCaption')}</caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.severity')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.kind')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.message')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.issuer')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.created')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr className="border-b border-border last:border-0" key={alert.id}>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_TONE[alert.severity]}`}>
                  {tSeverities(alert.severity)}
                </span>
              </td>
              <td className="px-4 py-3">{isAlertKind(alert.kind) ? tKinds(alert.kind) : alert.kind}</td>
              <td className="px-4 py-3">
                {alert.message}
                {alert.document ? (
                  <Link className="mt-1 block font-mono text-xs hover:underline" href={documentDetailRoute(alert.document.id)}>
                    {alert.document.full_number}
                  </Link>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {alert.issuer ? (
                  <Link className="hover:underline" href={issuerDetailRoute(alert.issuer.id)}>
                    {alert.issuer.legal_name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{t('service')}</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(alert.created_at, locale)}</td>
              <td className="px-4 py-3">
                <ResolveAction alert={alert} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResolveAction({ alert }: { alert: Alert }) {
  const t = useTranslations('alerts');
  const locale = useLocale();
  const resolvingAlertId = useOperationsStore((s) => s.resolvingAlertId);
  const resolve = useOperationsStore((s) => s.resolve);
  const [failed, setFailed] = useState(false);

  if (alert.resolved_at) {
    return <span className="text-xs text-muted-foreground">{t('resolved', { date: formatDateTime(alert.resolved_at, locale) })}</span>;
  }

  const onResolve = async () => {
    setFailed(false);
    setFailed(!(await resolve(alert.id)));
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        aria-label={`${t('resolve')}: ${alert.message}`}
        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        disabled={resolvingAlertId === alert.id}
        onClick={() => void onResolve()}
        type="button"
      >
        {t('resolve')}
      </button>
      {failed ? (
        <span className="text-xs text-destructive" role="alert">
          {t('resolveError')}
        </span>
      ) : null}
    </span>
  );
}

'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Choice } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, SkeletonTable } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { ROUTES, documentDetailRoute, issuerDetailRoute } from '@/lib/constants';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { isAlertKind, type Alert } from '@/lib/services/operations';
import { useConsoleStore } from '@/lib/stores/consoleStore';
import { useOperationsStore } from '@/lib/stores/operationsStore';

const SEVERITY_TONE: Record<Alert['severity'], BadgeTone> = { critical: 'danger', warning: 'warning' };

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
    <Page>
      <PageHeader
        actions={<Choice checked={includeResolved} label={t('showResolved')} onChange={(e) => void showResolvedAlerts(e.target.checked)} />}
        emoji="alerts"
        subtitle={t('subtitle')}
        title={t('title')}
      />
      <AlertResults />
    </Page>
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
  if (!alerts) return <SkeletonTable />;
  if (alerts.results.length === 0) {
    return <EmptyState body={t('emptyBody')} emoji="success" title={includeResolved ? t('emptyAll') : t('empty')} />;
  }

  return (
    <>
      <AlertTable alerts={alerts.results} />
      <Pagination
        busy={status === 'loading'}
        hasNext={Boolean(alerts.next)}
        hasPrevious={Boolean(alerts.previous)}
        label={t('pagination')}
        nextLabel={t('next')}
        onNext={() => void goToAlertsPage(alerts.next)}
        onPrevious={() => void goToAlertsPage(alerts.previous)}
        previousLabel={t('previous')}
        summary={t('pageInfo', { page, count: alerts.count })}
      />
    </>
  );
}

function AlertTable({ alerts }: { alerts: Alert[] }) {
  const t = useTranslations('alerts');
  const tSeverities = useTranslations('operations.severities');
  const tKinds = useTranslations('operations.alertKinds');
  const locale = useLocale();

  return (
    <DataTable<Alert>
      caption={t('tableCaption')}
      columns={[
        {
          key: 'severity',
          header: t('columns.severity'),
          mobile: 'badge',
          cell: (alert) => (
            <Badge size="sm" tone={alert.resolved_at ? 'neutral' : SEVERITY_TONE[alert.severity]}>
              {tSeverities(alert.severity)}
            </Badge>
          ),
        },
        { key: 'kind', header: t('columns.kind'), mobile: 'title', className: 'font-semibold text-ink', cell: (alert) => (isAlertKind(alert.kind) ? tKinds(alert.kind) : alert.kind) },
        {
          key: 'message',
          header: t('columns.message'),
          mobile: 'body',
          className: 'max-w-md',
          cell: (alert) => (
            <>
              <span className="block font-normal text-ink">{alert.message}</span>
              {alert.document ? (
                <Link className="mt-1 block font-mono text-[12px] text-primary-text hover:underline" href={documentDetailRoute(alert.document.id)}>
                  {alert.document.full_number}
                </Link>
              ) : null}
            </>
          ),
        },
        {
          key: 'issuer',
          header: t('columns.issuer'),
          cell: (alert) =>
            alert.issuer ? (
              <Link className="font-medium text-ink hover:text-primary-text hover:underline" href={issuerDetailRoute(alert.issuer.id)}>
                {alert.issuer.legal_name}
              </Link>
            ) : (
              <span className="text-ink-3">{t('service')}</span>
            ),
        },
        {
          key: 'created',
          header: t('columns.created'),
          className: 'whitespace-nowrap',
          cell: (alert) => <span title={formatDateTime(alert.created_at, locale)}>{formatRelative(alert.created_at, locale)}</span>,
        },
        { key: 'actions', header: t('columns.actions'), mobile: 'action', align: 'end', cell: (alert) => <ResolveAction alert={alert} /> },
      ]}
      rowKey={(alert) => alert.id}
      rows={alerts}
    />
  );
}

function ResolveAction({ alert }: { alert: Alert }) {
  const t = useTranslations('alerts');
  const locale = useLocale();
  const resolvingAlertId = useOperationsStore((s) => s.resolvingAlertId);
  const resolve = useOperationsStore((s) => s.resolve);
  const loadSummary = useConsoleStore((s) => s.loadSummary);
  const [failed, setFailed] = useState(false);

  if (alert.resolved_at) {
    return <span className="text-[13px] text-ink-3">{t('resolved', { date: formatDateTime(alert.resolved_at, locale) })}</span>;
  }

  const onResolve = async () => {
    setFailed(false);
    const resolved = await resolve(alert.id);
    setFailed(!resolved);
    if (resolved) {
      toast(t('resolvedToast'));
      void loadSummary();
    }
  };

  const fix = fixLink(alert);
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {fix ? (
        <Link className="text-[13px] font-semibold text-primary-text hover:underline" href={fix.href}>
          {t(fix.label)}
        </Link>
      ) : null}
      <Button aria-label={`${t('resolve')}: ${alert.message}`} loading={resolvingAlertId === alert.id} onClick={() => void onResolve()} size="sm" variant="soft">
        {t('resolve')}
      </Button>
      {failed ? (
        <span className="w-full text-right text-[13px] font-semibold text-danger-fg" role="alert">
          {t('resolveError')}
        </span>
      ) : null}
    </span>
  );
}

/** Where each kind of alert gets fixed (H-30). */
function fixLink(alert: Alert): { href: string; label: 'fixCertificate' | 'fixRange' | 'fixContingency' } | null {
  if (!alert.issuer) return null;
  const issuer = issuerDetailRoute(alert.issuer.id);
  if (alert.kind === 'certificate_expiring') return { href: `${issuer}?tab=certificates`, label: 'fixCertificate' };
  if (alert.kind === 'range_low' || alert.kind === 'resolution_expiring') return { href: `${issuer}?tab=numbering`, label: 'fixRange' };
  if (alert.kind === 'contingency_deadline') return { href: ROUTES.CONTINGENCIES, label: 'fixContingency' };
  return null;
}

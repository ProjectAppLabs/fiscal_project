'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { CheckCheck, Download } from 'lucide-react';

import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Choice, Field, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, SkeletonTable } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { ROUTES, documentDetailRoute, issuerDetailRoute } from '@/lib/constants';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { stepErrors } from '@/lib/services/onboarding';
import { ALERT_KINDS, ALERT_SEVERITIES, isAlertKind, resolveAlerts, type Alert, type AlertSeverity } from '@/lib/services/operations';
import { exportAlerts } from '@/lib/services/support';
import { useConsoleStore } from '@/lib/stores/consoleStore';
import { useOperationsStore } from '@/lib/stores/operationsStore';

const SEVERITY_TONE: Record<Alert['severity'], BadgeTone> = { critical: 'danger', warning: 'warning' };

export default function AlertsPage() {
  const t = useTranslations('alerts');
  const { isAuthenticated } = useRequireAuth();
  const includeResolved = useOperationsStore((s) => s.includeResolved);
  const loadAlerts = useOperationsStore((s) => s.loadAlerts);
  const showResolvedAlerts = useOperationsStore((s) => s.showResolvedAlerts);

  const alertFilters = useOperationsStore((s) => s.alertFilters);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) void loadAlerts();
  }, [isAuthenticated, loadAlerts]);

  if (!isAuthenticated) return null;

  const onExport = async () => {
    setExporting(true);
    try {
      await exportAlerts(includeResolved, alertFilters);
    } catch {
      toast(t('exportFailed'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Page>
      <PageHeader
        actions={
          <Button icon={<Download aria-hidden className="size-4" />} loading={exporting} onClick={() => void onExport()} variant="secondary">
            {t('export')}
          </Button>
        }
        emoji="alerts"
        subtitle={t('subtitle')}
        title={t('title')}
      />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <AlertFilterBar />
        <Choice checked={includeResolved} className="pb-2.5" label={t('showResolved')} onChange={(e) => void showResolvedAlerts(e.target.checked)} />
      </div>
      <AlertResults />
    </Page>
  );
}

/** Severity and kind (H-29); the list goes back to page 1 on each change. */
function AlertFilterBar() {
  const t = useTranslations('alerts');
  const tSeverities = useTranslations('operations.severities');
  const tKinds = useTranslations('operations.alertKinds');
  const filters = useOperationsStore((s) => s.alertFilters);
  const filterAlerts = useOperationsStore((s) => s.filterAlerts);

  return (
    <>
      <Field className="w-44" id="alert-severity" label={t('filterSeverity')}>
        <Select id="alert-severity" onChange={(e) => void filterAlerts({ ...filters, severity: e.target.value as AlertSeverity | '' })} value={filters.severity}>
          <option value="">{t('allSeverities')}</option>
          {ALERT_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {tSeverities(severity)}
            </option>
          ))}
        </Select>
      </Field>
      <Field className="w-64" id="alert-kind" label={t('filterKind')}>
        <Select id="alert-kind" onChange={(e) => void filterAlerts({ ...filters, kind: e.target.value })} value={filters.kind}>
          <option value="">{t('allKinds')}</option>
          {ALERT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {tKinds(kind)}
            </option>
          ))}
        </Select>
      </Field>
    </>
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
      <AlertTable alerts={alerts.results} key={alerts.results.map((alert) => alert.id).join('-')} />
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
  const loadAlerts = useOperationsStore((s) => s.loadAlerts);
  const loadSummary = useConsoleStore((s) => s.loadSummary);
  const [selected, setSelected] = useState<number[]>([]);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const open = alerts.filter((alert) => !alert.resolved_at);
  const toggle = (id: number) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const allSelected = open.length > 0 && open.every((alert) => selected.includes(alert.id));

  const resolveSelected = async () => {
    setBusy(true);
    try {
      const count = await resolveAlerts(selected, note.trim());
      toast(t('resolvedMany', { count }));
      setNoting(false);
      setNote('');
      setSelected([]);
      void loadAlerts();
      void loadSummary();
    } catch (error) {
      toast(stepErrors(error)[0] ?? t('resolveError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-surface-sunk/60 px-4 py-2.5">
          <Choice
            checked={allSelected}
            label={t('selectAll')}
            onChange={() => setSelected(allSelected ? [] : open.map((alert) => alert.id))}
          />
          <span className="text-[13px] text-ink-3">{t('selectedCount', { count: selected.length })}</span>
          <Button className="ml-auto" disabled={!selected.length} icon={<CheckCheck aria-hidden className="size-4" />} onClick={() => setNoting(true)} size="sm" variant="primary">
            {t('resolveSelected')}
          </Button>
        </div>
      ) : null}
      <DataTable<Alert>
        caption={t('tableCaption')}
        columns={[
          {
            key: 'select',
            header: <span className="sr-only">{t('select')}</span>,
            mobile: 'action',
            cell: (alert) =>
              alert.resolved_at ? null : (
                <input
                  aria-label={`${t('select')}: ${alert.message}`}
                  checked={selected.includes(alert.id)}
                  className="size-5 cursor-pointer accent-[var(--primary)]"
                  onChange={() => toggle(alert.id)}
                  type="checkbox"
                />
              ),
          },
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
      <ConfirmDialog
        busy={busy}
        confirmLabel={t('resolveSelected')}
        description={t('resolveManyBody', { count: selected.length })}
        onClose={() => setNoting(false)}
        onConfirm={() => void resolveSelected()}
        open={noting}
        title={t('resolveManyTitle', { count: selected.length })}
      >
        <Field hint={t('noteHint')} id="alerts-note" label={t('note')}>
          <Textarea id="alerts-note" maxLength={500} onChange={(e) => setNote(e.target.value)} rows={3} value={note} />
        </Field>
      </ConfirmDialog>
    </>
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
    return (
      <span className="block text-right text-[13px] text-ink-3">
        <span className="block">{t('resolved', { date: formatDateTime(alert.resolved_at, locale) })}</span>
        <span className="block">{alert.resolved_by ? t('resolvedBy', { name: alert.resolved_by }) : t('resolvedByFiscal')}</span>
        {alert.resolution_note ? <span className="mt-1 block italic text-ink-2">«{alert.resolution_note}»</span> : null}
      </span>
    );
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

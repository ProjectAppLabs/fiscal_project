'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';

import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState, SkeletonTable } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { documentDetailRoute } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { stepErrors } from '@/lib/services/onboarding';
import type { Contingency } from '@/lib/services/operations';
import { runDocumentAction } from '@/lib/services/support';
import { useOperationsStore } from '@/lib/stores/operationsStore';

// The annex gives 48 hours; the alerts warn at 24 h and 40 h, so under 8 hours left is urgent.
const URGENT_HOURS = 8;
const DEADLINE_HOURS = 48;

export default function ContingenciesPage() {
  const t = useTranslations('contingencies');
  const { isAuthenticated } = useRequireAuth();
  const contingencies = useOperationsStore((s) => s.contingencies);
  const status = useOperationsStore((s) => s.contingenciesStatus);
  const loadContingencies = useOperationsStore((s) => s.loadContingencies);

  useEffect(() => {
    if (isAuthenticated) void loadContingencies();
  }, [isAuthenticated, loadContingencies]);

  if (!isAuthenticated) return null;

  const urgent = (contingencies ?? []).filter((item) => item.hours_left < URGENT_HOURS).length;
  return (
    <Page>
      <PageHeader emoji="contingencies" subtitle={t('subtitle')} title={t('title')} />
      {status === 'error' ? (
        <ConsoleLoadError message={t('error')} onRetry={() => void loadContingencies()} />
      ) : !contingencies ? (
        <SkeletonTable />
      ) : contingencies.length === 0 ? (
        <EmptyState body={t('emptyBody')} emoji="success" title={t('empty')} />
      ) : (
        <div className="flex flex-col gap-4">
          {urgent ? (
            <Notice title={t('urgentNotice', { count: urgent })} tone="danger">
              {t('urgentNoticeBody')}
            </Notice>
          ) : null}
          <ContingencyTable contingencies={[...contingencies].sort((a, b) => a.hours_left - b.hours_left)} />
        </div>
      )}
    </Page>
  );
}

function ContingencyTable({ contingencies }: { contingencies: Contingency[] }) {
  const t = useTranslations('contingencies');
  const locale = useLocale();

  return (
    <DataTable<Contingency>
      caption={t('tableCaption')}
      columns={[
        {
          key: 'invoice',
          header: t('columns.invoice'),
          mobile: 'title',
          cell: (item) => (
            <Link className="font-mono text-[13px] font-medium text-primary-text hover:underline" href={documentDetailRoute(item.id)}>
              {item.full_number}
            </Link>
          ),
        },
        {
          key: 'issuer',
          header: t('columns.issuer'),
          mobile: 'body',
          cell: (item) => (
            <>
              <span className="block font-semibold text-ink">{item.issuer.legal_name}</span>
              <span className="block font-mono text-[12px] text-ink-3">{item.issuer.nit}</span>
            </>
          ),
        },
        {
          key: 'kind',
          header: t('columns.kind'),
          mobile: 'badge',
          cell: (item) => (
            <Badge size="sm" tone="warning">
              {t(`kinds.${item.contingency}`)}
            </Badge>
          ),
        },
        { key: 'started', header: t('columns.started'), mobile: 'hidden', className: 'whitespace-nowrap', cell: (item) => formatDateTime(item.started_at, locale) },
        { key: 'deadline', header: t('columns.deadline'), className: 'whitespace-nowrap', cell: (item) => formatDateTime(item.deadline_at, locale) },
        { key: 'left', header: t('columns.left'), className: 'min-w-40', cell: (item) => <HoursLeft hours={item.hours_left} /> },
        { key: 'attempts', header: t('columns.attempts'), align: 'end', mobile: 'hidden', className: 'tabular-nums', cell: (item) => item.attempts },
        { key: 'actions', header: t('columns.actions'), align: 'end', mobile: 'action', cell: (item) => (item.contingency === 'dian' ? <TransmitNow item={item} /> : null) },
      ]}
      rowKey={(item) => item.id}
      rows={contingencies}
    />
  );
}

/** Without waiting for the next 30-minute sweep (H-26): the document goes first in the queue and Fiscal. tries now. */
function TransmitNow({ item }: { item: Contingency }) {
  const t = useTranslations('contingencies');
  const loadContingencies = useOperationsStore((s) => s.loadContingencies);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      await runDocumentAction(item.id, 'transmit');
      toast(t('transmitted', { number: item.full_number }));
      void loadContingencies();
    } catch (error) {
      toast(stepErrors(error)[0] ?? t('transmitFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button aria-label={`${t('transmit')}: ${item.full_number}`} icon={<Send aria-hidden className="size-4" />} loading={busy} onClick={() => void onClick()} size="sm" variant="soft">
      {t('transmit')}
    </Button>
  );
}

/** The 48-hour clock: hours left with a bar that turns amber under 24 h and rose under 8 h or once overdue. */
export function HoursLeft({ hours }: { hours: number }) {
  const t = useTranslations('contingencies');
  const locale = useLocale();
  const format = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const tone = hours < URGENT_HOURS ? 'danger' : hours < 24 ? 'warning' : 'aurora';

  return (
    <span className="flex flex-col gap-1.5">
      {hours < 0 ? (
        <span className="font-semibold text-danger-fg">{t('overdue', { hours: format(-hours) })}</span>
      ) : (
        <span className={hours < URGENT_HOURS ? 'font-semibold text-danger-fg' : 'tabular-nums text-ink'}>{t('hoursLeft', { hours: format(hours) })}</span>
      )}
      <ProgressBar className="w-32" tone={tone} value={Math.max(0, DEADLINE_HOURS - hours) / DEADLINE_HOURS} />
    </span>
  );
}

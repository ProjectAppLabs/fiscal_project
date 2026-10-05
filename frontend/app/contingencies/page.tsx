'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ConsoleLoadError, ConsoleLoading } from '@/components/console/ConsoleStatus';
import { documentDetailRoute } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import type { Contingency } from '@/lib/services/operations';
import { useOperationsStore } from '@/lib/stores/operationsStore';

// The annex gives 48 hours; the alerts warn at 24 h and 40 h, so under 8 hours left is urgent.
const URGENT_HOURS = 8;

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

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      {status === 'error' ? (
        <ConsoleLoadError message={t('error')} onRetry={() => void loadContingencies()} />
      ) : !contingencies ? (
        <ConsoleLoading />
      ) : contingencies.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm">{t('empty')}</p>
      ) : (
        <ContingencyTable contingencies={contingencies} />
      )}
    </main>
  );
}

function ContingencyTable({ contingencies }: { contingencies: Contingency[] }) {
  const t = useTranslations('contingencies');
  const locale = useLocale();

  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t('tableCaption')}</caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.invoice')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.issuer')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.kind')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.started')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.deadline')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.left')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.attempts')}</th>
          </tr>
        </thead>
        <tbody>
          {contingencies.map((item) => (
            <tr className="border-b border-border last:border-0" key={item.id}>
              <td className="px-4 py-3 font-mono">
                <Link className="hover:underline" href={documentDetailRoute(item.id)}>
                  {item.full_number}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className="block">{item.issuer.legal_name}</span>
                <span className="block text-xs text-muted-foreground">{item.issuer.nit}</span>
              </td>
              <td className="px-4 py-3">{t(`kinds.${item.contingency}`)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(item.started_at, locale)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(item.deadline_at, locale)}</td>
              <td className="px-4 py-3">
                <HoursLeft hours={item.hours_left} />
              </td>
              <td className="px-4 py-3 tabular-nums">{item.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HoursLeft({ hours }: { hours: number }) {
  const t = useTranslations('contingencies');
  const locale = useLocale();
  const format = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

  if (hours < 0) return <span className="font-semibold text-destructive">{t('overdue', { hours: format(-hours) })}</span>;
  return (
    <span className={hours < URGENT_HOURS ? 'font-semibold text-destructive' : 'tabular-nums'}>
      {t('hoursLeft', { hours: format(hours) })}
    </span>
  );
}

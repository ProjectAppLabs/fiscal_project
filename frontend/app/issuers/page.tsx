'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';

import { ConsoleLoadError, ConsoleLoading } from '@/components/console/ConsoleStatus';
import { issuerDetailRoute } from '@/lib/constants';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { daysUntil, type IssuerListItem } from '@/lib/services/operations';
import { useOperationsStore } from '@/lib/stores/operationsStore';

const INPUT_CLASS =
  'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PAGER_BUTTON_CLASS =
  'rounded-full border border-border px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const CERTIFICATE_WARNING_DAYS = 30;

export default function IssuersPage() {
  const t = useTranslations('issuers');
  const { isAuthenticated } = useRequireAuth();
  const loadIssuers = useOperationsStore((s) => s.loadIssuers);

  useEffect(() => {
    if (isAuthenticated) void loadIssuers();
  }, [isAuthenticated, loadIssuers]);

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <IssuerSearch />
      <IssuerResults />
    </main>
  );
}

function IssuerSearch() {
  const t = useTranslations('issuers');
  const query = useOperationsStore((s) => s.issuerQuery);
  const searchIssuers = useOperationsStore((s) => s.searchIssuers);
  const [value, setValue] = useState(query);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void searchIssuers(value.trim());
  };

  return (
    <form className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={onSubmit} role="search">
      <div>
        <label className="mb-1 block text-sm" htmlFor="issuers-search">
          {t('searchLabel')}
        </label>
        <input id="issuers-search" className={INPUT_CLASS} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button
        className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="submit"
      >
        {t('searchSubmit')}
      </button>
    </form>
  );
}

function IssuerResults() {
  const t = useTranslations('issuers');
  const issuers = useOperationsStore((s) => s.issuers);
  const status = useOperationsStore((s) => s.issuersStatus);
  const page = useOperationsStore((s) => s.issuersPage);
  const loadIssuers = useOperationsStore((s) => s.loadIssuers);
  const goToIssuersPage = useOperationsStore((s) => s.goToIssuersPage);

  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={() => void loadIssuers()} />;
  if (!issuers) return <ConsoleLoading />;
  if (issuers.results.length === 0) {
    return <p className="mt-10 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm">{t('empty')}</p>;
  }

  return (
    <>
      <IssuerTable issuers={issuers.results} />
      <nav aria-label={t('pagination')} className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t('pageInfo', { page, count: issuers.count })}</p>
        <div className="flex gap-2">
          <button
            className={PAGER_BUTTON_CLASS}
            disabled={!issuers.previous || status === 'loading'}
            onClick={() => void goToIssuersPage(issuers.previous)}
            type="button"
          >
            {t('previous')}
          </button>
          <button
            className={PAGER_BUTTON_CLASS}
            disabled={!issuers.next || status === 'loading'}
            onClick={() => void goToIssuersPage(issuers.next)}
            type="button"
          >
            {t('next')}
          </button>
        </div>
      </nav>
    </>
  );
}

function IssuerTable({ issuers }: { issuers: IssuerListItem[] }) {
  const t = useTranslations('issuers');
  const tEnvironments = useTranslations('operations.environments');

  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t('tableCaption')}</caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.issuer')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.environment')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.client')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.documents')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.certificate')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.alerts')}</th>
          </tr>
        </thead>
        <tbody>
          {issuers.map((issuer) => (
            <tr className="border-b border-border last:border-0" key={issuer.id}>
              <td className="px-4 py-3">
                <Link className="block hover:underline" href={issuerDetailRoute(issuer.id)}>
                  {issuer.legal_name}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {issuer.nit}-{issuer.dv}
                </span>
              </td>
              <td className="px-4 py-3">{tEnvironments(issuer.environment)}</td>
              <td className="px-4 py-3">{issuer.client}</td>
              <td className="px-4 py-3 tabular-nums">{issuer.documents}</td>
              <td className="px-4 py-3">
                <CertificateExpiry expires={issuer.certificate_expires} />
              </td>
              <td className={`px-4 py-3 tabular-nums ${issuer.open_alerts ? 'text-destructive' : ''}`}>{issuer.open_alerts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CertificateExpiry({ expires }: { expires: string | null }) {
  const t = useTranslations('issuers');
  const days = daysUntil(expires);

  if (days === null) return <span className="text-destructive">{t('noCertificate')}</span>;
  if (days < 0) return <span className="text-destructive">{t('certificateExpired')}</span>;
  return (
    <span className={days <= CERTIFICATE_WARNING_DAYS ? 'text-destructive' : ''}>{t('certificateDays', { days })}</span>
  );
}

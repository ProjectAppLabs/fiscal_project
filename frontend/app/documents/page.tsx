'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';

import { ConsoleLoadError, ConsoleLoading, DocumentStateBadge } from '@/components/console/ConsoleStatus';
import { documentDetailRoute } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { DOCUMENT_STATES, type DocumentListItem, type DocumentState } from '@/lib/services/console';
import { useConsoleStore } from '@/lib/stores/consoleStore';

const INPUT_CLASS =
  'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PAGER_BUTTON_CLASS =
  'rounded-full border border-border px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const { isAuthenticated } = useRequireAuth();
  const loadDocuments = useConsoleStore((s) => s.loadDocuments);

  useEffect(() => {
    if (isAuthenticated) void loadDocuments();
  }, [isAuthenticated, loadDocuments]);

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <DocumentFiltersForm />
      <DocumentResults />
    </main>
  );
}

function DocumentFiltersForm() {
  const t = useTranslations('documents');
  const tStates = useTranslations('console.state');
  const filters = useConsoleStore((s) => s.filters);
  const applyFilters = useConsoleStore((s) => s.applyFilters);
  const [state, setState] = useState<DocumentState | ''>(filters.state);
  const [issuer, setIssuer] = useState(filters.issuer);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void applyFilters({ state, issuer: issuer.trim() });
  };

  return (
    <form
      aria-label={t('filtersLabel')}
      className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={onSubmit}
    >
      <div>
        <label className="mb-1 block text-sm" htmlFor="documents-state">
          {t('filterState')}
        </label>
        <select
          id="documents-state"
          className={INPUT_CLASS}
          value={state}
          onChange={(e) => setState(e.target.value as DocumentState | '')}
        >
          <option value="">{t('allStates')}</option>
          {DOCUMENT_STATES.map((value) => (
            <option key={value} value={value}>
              {tStates(value)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm" htmlFor="documents-issuer">
          {t('filterIssuer')}
        </label>
        <input
          id="documents-issuer"
          className={INPUT_CLASS}
          inputMode="numeric"
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
        />
      </div>
      <button
        className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="submit"
      >
        {t('filterSubmit')}
      </button>
    </form>
  );
}

function DocumentResults() {
  const t = useTranslations('documents');
  const documents = useConsoleStore((s) => s.documents);
  const status = useConsoleStore((s) => s.documentsStatus);
  const page = useConsoleStore((s) => s.page);
  const loadDocuments = useConsoleStore((s) => s.loadDocuments);
  const goToNextPage = useConsoleStore((s) => s.goToNextPage);
  const goToPreviousPage = useConsoleStore((s) => s.goToPreviousPage);

  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={() => void loadDocuments()} />;
  if (!documents) return <ConsoleLoading />;
  if (documents.results.length === 0) {
    return <p className="mt-10 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm">{t('empty')}</p>;
  }

  return (
    <>
      <DocumentTable documents={documents.results} />
      <nav aria-label={t('pagination')} className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t('pageInfo', { page, count: documents.count })}</p>
        <div className="flex gap-2">
          <button
            className={PAGER_BUTTON_CLASS}
            disabled={!documents.previous || status === 'loading'}
            onClick={() => void goToPreviousPage()}
            type="button"
          >
            {t('previous')}
          </button>
          <button
            className={PAGER_BUTTON_CLASS}
            disabled={!documents.next || status === 'loading'}
            onClick={() => void goToNextPage()}
            type="button"
          >
            {t('next')}
          </button>
        </div>
      </nav>
    </>
  );
}

function DocumentTable({ documents }: { documents: DocumentListItem[] }) {
  const t = useTranslations('documents');
  const tKinds = useTranslations('console.kinds');
  const locale = useLocale();

  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t('tableCaption')}</caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.number')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.kind')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.issuer')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.client')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.state')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.attempts')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.issued')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.created')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.validated')}</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr className="border-b border-border last:border-0" key={document.id}>
              <td className="px-4 py-3 font-mono">
                <Link className="hover:underline" href={documentDetailRoute(document.id)}>
                  {document.full_number}
                </Link>
              </td>
              <td className="px-4 py-3">{tKinds(document.kind)}</td>
              <td className="px-4 py-3">
                <span className="block">{document.issuer.legal_name}</span>
                <span className="block text-xs text-muted-foreground">{document.issuer.nit}</span>
              </td>
              <td className="px-4 py-3">{document.client}</td>
              <td className="px-4 py-3">
                <DocumentStateBadge state={document.state} />
              </td>
              <td className="px-4 py-3 tabular-nums">{document.attempts}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(document.issue_datetime, locale)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(document.created_at, locale)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(document.validated_at, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

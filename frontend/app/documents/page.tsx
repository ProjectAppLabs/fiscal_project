'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';

import { ConsoleLoadError, DocumentStateBadge } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Field, Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, SkeletonTable } from '@/components/ui/States';
import { documentDetailRoute } from '@/lib/constants';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useQueryParams } from '@/lib/hooks/useQueryParams';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { DOCUMENT_STATES, type DocumentListItem, type DocumentState } from '@/lib/services/console';
import { useConsoleStore } from '@/lib/stores/consoleStore';

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const locale = useLocale();
  const { isAuthenticated } = useRequireAuth();
  const loadDocuments = useConsoleStore((s) => s.loadDocuments);
  const applyFilters = useConsoleStore((s) => s.applyFilters);
  const documents = useConsoleStore((s) => s.documents);
  const filters = useConsoleStore((s) => s.filters);
  const { read } = useQueryParams();

  useEffect(() => {
    if (!isAuthenticated) return;
    // A link like /documents?state=rejected (from the dashboard) opens already filtered.
    const state = read('state') as DocumentState | '';
    const issuer = read('issuer');
    if (state || issuer) void applyFilters({ state: DOCUMENT_STATES.includes(state as DocumentState) ? state : '', issuer });
    else void loadDocuments();
  }, [isAuthenticated, loadDocuments, applyFilters, read]);

  if (!isAuthenticated) return null;

  return (
    <Page>
      <PageHeader
        emoji="documents"
        subtitle={documents ? t('subtitle', { count: formatNumber(documents.count, locale) }) : undefined}
        title={t('title')}
      />
      <DocumentFiltersForm key={`${filters.state}|${filters.issuer}`} />
      <DocumentResults />
    </Page>
  );
}

function DocumentFiltersForm() {
  const t = useTranslations('documents');
  const tStates = useTranslations('console.state');
  const filters = useConsoleStore((s) => s.filters);
  const applyFilters = useConsoleStore((s) => s.applyFilters);
  const { write } = useQueryParams();
  const [state, setState] = useState<DocumentState | ''>(filters.state);
  const [issuer, setIssuer] = useState(filters.issuer);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = { state, issuer: issuer.trim() };
    write(next);
    void applyFilters(next);
  };

  return (
    <form
      aria-label={t('filtersLabel')}
      className="mb-6 grid gap-4 rounded-card bg-surface-sunk/60 p-4 shadow-sunk sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={onSubmit}
    >
      <Field id="documents-state" label={t('filterState')}>
        <Select id="documents-state" onChange={(e) => setState(e.target.value as DocumentState | '')} value={state}>
          <option value="">{t('allStates')}</option>
          {DOCUMENT_STATES.map((value) => (
            <option key={value} value={value}>
              {tStates(value)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="documents-issuer" label={t('filterIssuer')}>
        <Input id="documents-issuer" inputMode="numeric" onChange={(e) => setIssuer(e.target.value)} placeholder={t('issuerPlaceholder')} value={issuer} />
      </Field>
      <Button type="submit" variant="primary">
        {t('filterSubmit')}
      </Button>
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
  if (!documents) return <SkeletonTable />;
  if (documents.results.length === 0) return <EmptyState body={t('emptyBody')} title={t('empty')} />;

  return (
    <>
      <DocumentTable documents={documents.results} />
      <Pagination
        busy={status === 'loading'}
        hasNext={Boolean(documents.next)}
        hasPrevious={Boolean(documents.previous)}
        label={t('pagination')}
        nextLabel={t('next')}
        onNext={() => void goToNextPage()}
        onPrevious={() => void goToPreviousPage()}
        previousLabel={t('previous')}
        summary={t('pageInfo', { page, count: documents.count })}
      />
    </>
  );
}

function DocumentTable({ documents }: { documents: DocumentListItem[] }) {
  const t = useTranslations('documents');
  const tKinds = useTranslations('console.kinds');
  const locale = useLocale();

  const columns: Column<DocumentListItem>[] = [
    {
      key: 'number',
      header: t('columns.number'),
      mobile: 'title',
      cell: (document) => (
        <Link className="font-mono text-[13px] font-medium text-primary-text hover:underline" href={documentDetailRoute(document.id)}>
          {document.full_number}
        </Link>
      ),
    },
    { key: 'kind', header: t('columns.kind'), cell: (document) => tKinds(document.kind) },
    {
      key: 'issuer',
      header: t('columns.issuer'),
      mobile: 'body',
      cell: (document) => (
        <>
          <span className="block font-semibold text-ink">{document.issuer.legal_name}</span>
          <span className="block font-mono text-[12px] text-ink-3">{document.issuer.nit}</span>
        </>
      ),
    },
    { key: 'client', header: t('columns.client'), mobile: 'hidden', cell: (document) => document.client },
    { key: 'state', header: t('columns.state'), mobile: 'badge', cell: (document) => <DocumentStateBadge state={document.state} /> },
    { key: 'attempts', header: t('columns.attempts'), align: 'end', className: 'tabular-nums', cell: (document) => t('attemptsValue', { count: document.attempts }) },
    {
      key: 'issued',
      header: t('columns.issued'),
      className: 'whitespace-nowrap',
      cell: (document) => <span title={formatDateTime(document.issue_datetime, locale)}>{formatDateTime(document.issue_datetime, locale)}</span>,
    },
    { key: 'created', header: t('columns.created'), mobile: 'hidden', className: 'whitespace-nowrap text-ink-2', cell: (document) => formatDateTime(document.created_at, locale) },
    { key: 'validated', header: t('columns.validated'), mobile: 'hidden', className: 'whitespace-nowrap', cell: (document) => formatDateTime(document.validated_at, locale) },
  ];

  return <DataTable caption={t('tableCaption')} columns={columns} rowKey={(document) => document.id} rows={documents} />;
}

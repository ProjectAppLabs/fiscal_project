'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { Download } from 'lucide-react';

import { ConsoleLoadError, DocumentStateBadge } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Field, Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, SkeletonTable } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { documentDetailRoute } from '@/lib/constants';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useQueryParams } from '@/lib/hooks/useQueryParams';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { DOCUMENT_KINDS, DOCUMENT_STATES, FILTER_KEYS, type DocumentFilters, type DocumentKind, type DocumentListItem, type DocumentState } from '@/lib/services/console';
import { exportDocuments } from '@/lib/services/support';
import { useOperationsStore } from '@/lib/stores/operationsStore';
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
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    // A link like /documents?state=rejected (from the dashboard) opens already filtered (H-25).
    const fromUrl = Object.fromEntries(FILTER_KEYS.map((key) => [key, read(key)])) as Record<(typeof FILTER_KEYS)[number], string>;
    if (Object.values(fromUrl).some(Boolean)) {
      void applyFilters({
        ...fromUrl,
        state: DOCUMENT_STATES.includes(fromUrl.state as DocumentState) ? (fromUrl.state as DocumentState) : '',
        kind: DOCUMENT_KINDS.includes(fromUrl.kind as DocumentKind) ? (fromUrl.kind as DocumentKind) : '',
      });
    } else void loadDocuments();
  }, [isAuthenticated, loadDocuments, applyFilters, read]);

  if (!isAuthenticated) return null;

  const onExport = async () => {
    setExporting(true);
    try {
      await exportDocuments(filters);
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
        emoji="documents"
        subtitle={documents ? t('subtitle', { count: formatNumber(documents.count, locale) }) : undefined}
        title={t('title')}
      />
      <DocumentFiltersForm key={FILTER_KEYS.map((key) => filters[key] ?? '').join('|')} />
      <DocumentResults />
    </Page>
  );
}

function DocumentFiltersForm() {
  const t = useTranslations('documents');
  const tStates = useTranslations('console.state');
  const tKinds = useTranslations('console.kinds');
  const filters = useConsoleStore((s) => s.filters);
  const applyFilters = useConsoleStore((s) => s.applyFilters);
  const clients = useOperationsStore((s) => s.clientSystems);
  const loadClientSystems = useOperationsStore((s) => s.loadClientSystems);
  const { write } = useQueryParams();
  const [form, setForm] = useState<DocumentFilters>({ ...filters });
  const extraCount = (['kind', 'client', 'date_from', 'date_to'] as const).filter((key) => filters[key]).length;
  const [more, setMore] = useState(extraCount > 0);
  const set = (key: keyof DocumentFilters) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (more && !clients) void loadClientSystems();
  }, [more, clients, loadClientSystems]);

  const apply = (next: DocumentFilters) => {
    write(Object.fromEntries(FILTER_KEYS.map((key) => [key, (next[key] ?? '').trim()])));
    void applyFilters({ ...next, issuer: next.issuer.trim(), q: (next.q ?? '').trim() });
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    apply(form);
  };
  const hasFilters = FILTER_KEYS.some((key) => filters[key]);

  return (
    <form aria-label={t('filtersLabel')} className="mb-6 rounded-card bg-surface-sunk/60 p-4 shadow-sunk" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
        <Field id="documents-search" label={t('filterSearch')}>
          <Input className="font-mono" id="documents-search" onChange={(e) => set('q')(e.target.value)} placeholder={t('searchPlaceholder')} value={form.q ?? ''} />
        </Field>
        <Field id="documents-state" label={t('filterState')}>
          <Select id="documents-state" onChange={(e) => set('state')(e.target.value)} value={form.state}>
            <option value="">{t('allStates')}</option>
            {DOCUMENT_STATES.map((value) => (
              <option key={value} value={value}>
                {tStates(value)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="documents-issuer" label={t('filterIssuer')}>
          <Input id="documents-issuer" inputMode="numeric" onChange={(e) => set('issuer')(e.target.value)} placeholder={t('issuerPlaceholder')} value={form.issuer} />
        </Field>
        <Button type="submit" variant="primary">
          {t('filterSubmit')}
        </Button>
      </div>
      {more ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="documents-kind" label={t('filterKind')}>
            <Select id="documents-kind" onChange={(e) => set('kind')(e.target.value)} value={form.kind ?? ''}>
              <option value="">{t('allKinds')}</option>
              {DOCUMENT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {tKinds(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="documents-client" label={t('filterClient')}>
            <Select id="documents-client" onChange={(e) => set('client')(e.target.value)} value={form.client ?? ''}>
              <option value="">{t('allClients')}</option>
              {(clients ?? []).map((client) => (
                <option key={client.id} value={String(client.id)}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="documents-from" label={t('filterFrom')}>
            <Input id="documents-from" onChange={(e) => set('date_from')(e.target.value)} type="date" value={form.date_from ?? ''} />
          </Field>
          <Field id="documents-to" label={t('filterTo')}>
            <Input id="documents-to" onChange={(e) => set('date_to')(e.target.value)} type="date" value={form.date_to ?? ''} />
          </Field>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button aria-expanded={more} onClick={() => setMore((current) => !current)} size="sm" variant="ghost">
          {more ? t('lessFilters') : extraCount ? t('moreFiltersCount', { count: extraCount }) : t('moreFilters')}
        </Button>
        {hasFilters ? (
          <Button onClick={() => apply({ state: '', issuer: '', kind: '', client: '', date_from: '', date_to: '', q: '' })} size="sm" variant="ghost">
            {t('clearFilters')}
          </Button>
        ) : null}
      </div>
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

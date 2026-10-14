'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { FilePlus2, Search } from 'lucide-react';

import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, SkeletonTable } from '@/components/ui/States';
import { ROUTES, issuerDetailRoute } from '@/lib/constants';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { daysUntil, type IssuerListItem } from '@/lib/services/operations';
import { useOperationsStore } from '@/lib/stores/operationsStore';

const CERTIFICATE_WARNING_DAYS = 30;

export default function IssuersPage() {
  const t = useTranslations('issuers');
  const { isAuthenticated } = useRequireAuth();
  const loadIssuers = useOperationsStore((s) => s.loadIssuers);
  const issuers = useOperationsStore((s) => s.issuers);

  useEffect(() => {
    if (isAuthenticated) void loadIssuers();
  }, [isAuthenticated, loadIssuers]);

  if (!isAuthenticated) return null;

  return (
    <Page>
      <PageHeader
        actions={
          <ButtonLink href={ROUTES.ONBOARDING} icon={<FilePlus2 aria-hidden className="size-4" />} variant="primary">
            {t('enrol')}
          </ButtonLink>
        }
        emoji="issuers"
        subtitle={issuers ? t('subtitle', { count: issuers.count }) : undefined}
        title={t('title')}
      />
      <IssuerSearch />
      <IssuerResults />
    </Page>
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
    <form className="mb-6 flex gap-2" onSubmit={onSubmit} role="search">
      <label className="sr-only" htmlFor="issuers-search">
        {t('searchLabel')}
      </label>
      <div className="relative flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <Input className="pl-11" id="issuers-search" onChange={(e) => setValue(e.target.value)} placeholder={t('searchPlaceholder')} value={value} />
      </div>
      <Button className="h-12" type="submit" variant="secondary">
        {t('searchSubmit')}
      </Button>
    </form>
  );
}

function IssuerResults() {
  const t = useTranslations('issuers');
  const issuers = useOperationsStore((s) => s.issuers);
  const status = useOperationsStore((s) => s.issuersStatus);
  const page = useOperationsStore((s) => s.issuersPage);
  const query = useOperationsStore((s) => s.issuerQuery);
  const loadIssuers = useOperationsStore((s) => s.loadIssuers);
  const goToIssuersPage = useOperationsStore((s) => s.goToIssuersPage);

  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={() => void loadIssuers()} />;
  if (!issuers) return <SkeletonTable />;
  if (issuers.results.length === 0) {
    return (
      <EmptyState
        action={
          query ? undefined : (
            <ButtonLink href={ROUTES.ONBOARDING} size="sm" variant="primary">
              {t('enrol')}
            </ButtonLink>
          )
        }
        body={query ? t('emptySearchBody') : t('emptyBody')}
        emoji={query ? 'search' : 'empty'}
        title={t('empty')}
      />
    );
  }

  return (
    <>
      <IssuerTable issuers={issuers.results} />
      <Pagination
        busy={status === 'loading'}
        hasNext={Boolean(issuers.next)}
        hasPrevious={Boolean(issuers.previous)}
        label={t('pagination')}
        nextLabel={t('next')}
        onNext={() => void goToIssuersPage(issuers.next)}
        onPrevious={() => void goToIssuersPage(issuers.previous)}
        previousLabel={t('previous')}
        summary={t('pageInfo', { page, count: issuers.count })}
      />
    </>
  );
}

function IssuerTable({ issuers }: { issuers: IssuerListItem[] }) {
  const t = useTranslations('issuers');
  const tEnvironments = useTranslations('operations.environments');

  return (
    <DataTable<IssuerListItem>
      caption={t('tableCaption')}
      columns={[
        {
          key: 'issuer',
          header: t('columns.issuer'),
          mobile: 'body',
          cell: (issuer) => (
            <>
              <Link className="block font-semibold text-ink hover:text-primary-text hover:underline" href={issuerDetailRoute(issuer.id)}>
                {issuer.legal_name}
              </Link>
              <span className="block font-mono text-[12px] text-ink-3">
                {issuer.nit}-{issuer.dv}
              </span>
            </>
          ),
        },
        {
          key: 'environment',
          header: t('columns.environment'),
          mobile: 'badge',
          cell: (issuer) => (
            <Badge size="sm" tone={issuer.environment === '1' ? 'success' : 'pending'}>
              {tEnvironments(issuer.environment)}
            </Badge>
          ),
        },
        { key: 'client', header: t('columns.client'), mobile: 'title', cell: (issuer) => issuer.client },
        { key: 'documents', header: t('columns.documents'), align: 'end', className: 'tabular-nums', cell: (issuer) => issuer.documents },
        { key: 'certificate', header: t('columns.certificate'), cell: (issuer) => <CertificateExpiry expires={issuer.certificate_expires} /> },
        {
          key: 'alerts',
          header: t('columns.alerts'),
          align: 'end',
          cell: (issuer) =>
            issuer.open_alerts ? (
              <Badge size="sm" tone="danger">
                {issuer.open_alerts}
              </Badge>
            ) : (
              <span className="text-ink-3">0</span>
            ),
        },
      ]}
      rowKey={(issuer) => issuer.id}
      rows={issuers}
    />
  );
}

export function CertificateExpiry({ expires }: { expires: string | null }) {
  const t = useTranslations('issuers');
  const days = daysUntil(expires);

  if (days === null) return <Badge size="sm" tone="danger">{t('noCertificate')}</Badge>;
  if (days < 0) return <Badge size="sm" tone="danger">{t('certificateExpired')}</Badge>;
  if (days <= CERTIFICATE_WARNING_DAYS) return <Badge size="sm" tone={days <= 7 ? 'danger' : 'warning'}>{t('certificateDays', { days })}</Badge>;
  return <span className="text-ink-2">{t('certificateDays', { days })}</span>;
}

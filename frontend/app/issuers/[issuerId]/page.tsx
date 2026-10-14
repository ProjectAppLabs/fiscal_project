'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Upload } from 'lucide-react';

import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { CertificateForm, RangeFormFields, SoftwareFormFields } from '@/components/console/EnrolmentForms';
import { ProductionPanel } from '@/components/console/ProductionPanel';
import { TestSetPanel } from '@/components/console/TestSetPanel';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, DataItem, DataList } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar, usageTone } from '@/components/ui/Progress';
import { NotFoundState, SkeletonCard } from '@/components/ui/States';
import { Lifecycle, type LifecycleStep } from '@/components/ui/Steps';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import { ROUTES, documentDetailRoute } from '@/lib/constants';
import { formatDate, formatNumber } from '@/lib/format';
import { useQueryParams } from '@/lib/hooks/useQueryParams';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { fetchProduction, fetchTestSet, type ProductionStatus, type TestSetReadiness, type TestSetRun } from '@/lib/services/onboarding';
import { daysUntil, downloadContingencyLetter, isAlertKind, type Alert, type IssuerDetail, type IssuerRange } from '@/lib/services/operations';
import type { DetailStatus } from '@/lib/stores/consoleStore';
import { useOperationsStore } from '@/lib/stores/operationsStore';

const TABS = ['summary', 'habilitation', 'certificates', 'numbering', 'contingency'] as const;
type Tab = (typeof TABS)[number];
const CERTIFICATE_WARNING_DAYS = 30;

export default function IssuerDetailPage() {
  const t = useTranslations('issuerDetail');
  const { issuerId } = useParams<{ issuerId: string }>();
  const { isAuthenticated } = useRequireAuth();
  const issuer = useOperationsStore((s) => s.issuer);
  const status = useOperationsStore((s) => s.issuerStatus);
  const loadIssuer = useOperationsStore((s) => s.loadIssuer);

  useEffect(() => {
    if (isAuthenticated) void loadIssuer(issuerId);
  }, [isAuthenticated, issuerId, loadIssuer]);

  if (!isAuthenticated) return null;

  return (
    <Page>
      <Link className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-primary-text" href={ROUTES.ISSUERS}>
        ← {t('back')}
      </Link>
      <IssuerBody issuer={issuer} onRetry={() => void loadIssuer(issuerId)} status={status} />
    </Page>
  );
}

function IssuerBody({ issuer, status, onRetry }: { issuer: IssuerDetail | null; status: DetailStatus; onRetry: () => void }) {
  const t = useTranslations('issuerDetail');

  if (status === 'not-found') return <NotFoundState body={t('notFoundBody')} title={t('notFoundTitle')} />;
  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={onRetry} />;
  if (!issuer) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={5} />
      </div>
    );
  }
  return <IssuerView issuer={issuer} />;
}

function IssuerView({ issuer }: { issuer: IssuerDetail }) {
  const t = useTranslations('issuerDetail');
  const tEnvironments = useTranslations('operations.environments');
  const refreshIssuer = useOperationsStore((s) => s.refreshIssuer);
  const { read, write } = useQueryParams();
  const lifecycle = useLifecycleData(issuer.id);
  // The tab lives in the URL (?tab=numbering) so a link from an alert opens the right section.
  const [tab, setTab] = useState<Tab>(() => {
    const fromUrl = read('tab') as Tab;
    return TABS.includes(fromUrl) ? fromUrl : issuer.environment === '1' ? 'summary' : 'habilitation';
  });

  const changeTab = (next: Tab) => {
    setTab(next);
    write({ tab: next });
  };
  const refresh = () => {
    void refreshIssuer(issuer.id);
    lifecycle.reload();
  };

  const certificate = issuer.certificates.find((item) => item.active) ?? null;
  const certificateDays = daysUntil(certificate?.not_after ?? null);
  const incomplete = lifecycle.testSet ? missingForEnrolment(lifecycle.testSet.readiness) : [];

  return (
    <div className="appear">
      <PageHeader
        badge={
          <Badge size="lg" tone={issuer.environment === '1' ? 'success' : 'pending'}>
            {tEnvironments(issuer.environment)}
          </Badge>
        }
        breadcrumb={[{ label: t('breadcrumb'), href: ROUTES.ISSUERS }, { label: t('breadcrumbDetail') }]}
        emoji="issuers"
        subtitle={
          <>
            NIT <span className="font-mono">{issuer.nit}-{issuer.dv}</span> · {t('clientCaption', { client: issuer.client })}
            {issuer.active ? null : (
              <Badge className="ml-2" size="sm" tone="neutral">
                {t('inactive')}
              </Badge>
            )}
          </>
        }
        title={issuer.legal_name}
      />

      <div className="flex flex-col gap-4">
        <Card aria-label={t('lifecycleLabel')}>
          <Lifecycle label={t('lifecycleLabel')} steps={lifecycleSteps(issuer, lifecycle, t)} />
        </Card>

        {incomplete.length ? (
          <Notice
            action={
              <ButtonLink href={`${ROUTES.ONBOARDING}?issuer=${issuer.id}`} size="sm" variant="primary">
                {t('completeEnrolment')}
              </ButtonLink>
            }
            title={t('incompleteTitle')}
            tone="pending"
          >
            {t('incompleteBody', { missing: incomplete.map((key) => t(`missing.${key}`)).join(', ') })}
          </Notice>
        ) : null}

        {certificateDays !== null && certificateDays <= CERTIFICATE_WARNING_DAYS ? (
          <Notice
            action={
              <Button onClick={() => changeTab('certificates')} size="sm" variant="secondary">
                {t('viewCertificate')}
              </Button>
            }
            title={certificateDays < 0 ? t('certificateExpired') : t('certificateExpiring', { days: certificateDays })}
            tone={certificateDays <= 7 ? 'danger' : 'warning'}
          >
            {t('certificateExpiringBody')}
          </Notice>
        ) : null}

        <Tabs
          label={t('tabsLabel')}
          onChange={changeTab}
          tabs={TABS.map((value) => ({
            value,
            label: t(`tabs.${value}`),
            badge: value === 'summary' && issuer.alerts.length ? <Badge size="sm" tone="danger">{issuer.alerts.length}</Badge> : undefined,
          }))}
          value={tab}
        />

        <TabPanel value={tab}>
          {tab === 'summary' ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <IssuerData issuer={issuer} />
              <IssuerAlerts alerts={issuer.alerts} />
            </div>
          ) : null}
          {tab === 'habilitation' ? (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <TestSetPanel issuerId={issuer.id} onChange={refresh} />
              <ProductionPanel issuerId={issuer.id} onChange={refresh} />
            </div>
          ) : null}
          {tab === 'certificates' ? (
            <div className="flex flex-col gap-4">
              <Certificates issuer={issuer} onChange={refresh} />
              <Software issuer={issuer} onChange={refresh} />
            </div>
          ) : null}
          {tab === 'numbering' ? <Ranges issuer={issuer} onChange={refresh} /> : null}
          {tab === 'contingency' ? <ContingencyLetter issuerId={issuer.id} /> : null}
        </TabPanel>
      </div>
    </div>
  );
}

function IssuerData({ issuer }: { issuer: IssuerDetail }) {
  const t = useTranslations('issuerDetail');
  const tEnvironments = useTranslations('operations.environments');

  return (
    <Card aria-labelledby="issuer-data">
      <CardHeader id="issuer-data" title={t('dataTitle')} />
      <DataList>
        <DataItem label={t('fields.legalName')}>{issuer.legal_name}</DataItem>
        {issuer.trade_name ? <DataItem label={t('fields.tradeName')}>{issuer.trade_name}</DataItem> : null}
        <DataItem label={t('fields.nit')}>
          <span className="font-mono">
            {issuer.nit}-{issuer.dv}
          </span>
        </DataItem>
        <DataItem label={t('fields.environment')}>{tEnvironments(issuer.environment)}</DataItem>
        <DataItem label={t('fields.client')}>{issuer.client}</DataItem>
        <DataItem label={t('fields.personType')}>{t(`personTypes.${issuer.person_type}`)}</DataItem>
        <DataItem label={t('fields.responsibilities')}>{issuer.tax_responsibilities.join(', ') || '—'}</DataItem>
        <DataItem label={t('fields.email')}>{issuer.email}</DataItem>
        <DataItem label={t('fields.address')}>
          {issuer.address.line} · DANE <span className="font-mono">{issuer.address.municipality_code}</span>
        </DataItem>
      </DataList>
    </Card>
  );
}

function IssuerAlerts({ alerts }: { alerts: Alert[] }) {
  const t = useTranslations('issuerDetail');
  const tKinds = useTranslations('operations.alertKinds');

  return (
    <Card aria-labelledby="issuer-alerts">
      <CardHeader id="issuer-alerts" title={t('alertsTitle')} />
      {alerts.length === 0 ? (
        <p className="text-[15px] text-ink-2">{t('noAlerts')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <li className={alert.severity === 'critical' ? 'rounded-lg bg-danger-bg px-4 py-3 text-danger-fg' : 'rounded-lg bg-warning-bg px-4 py-3 text-warning-fg'} key={alert.id}>
              <span className="block text-[13px] font-bold">{isAlertKind(alert.kind) ? tKinds(alert.kind) : alert.kind}</span>
              <span className="block text-[15px]">
                {alert.message}
                {alert.document ? (
                  <>
                    {' '}
                    <Link className="font-mono text-[13px] underline" href={documentDetailRoute(alert.document.id)}>
                      {alert.document.full_number}
                    </Link>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Certificates and «Reemplazar certificado» (H-12): the old one stays in the list as inactive. */
function Certificates({ issuer, onChange }: { issuer: IssuerDetail; onChange: () => void }) {
  const t = useTranslations('issuerDetail');
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <Card aria-labelledby="issuer-certificates">
      <CardHeader
        action={
          <Button icon={<Upload aria-hidden className="size-4" />} onClick={() => setOpen(true)} size="sm" variant="primary">
            {issuer.certificates.length ? t('replaceCertificate') : t('uploadCertificate')}
          </Button>
        }
        id="issuer-certificates"
        title={t('certificatesTitle')}
      />
      {issuer.certificates.length === 0 ? (
        <Notice tone="danger">{t('noCertificates')}</Notice>
      ) : (
        <DataTable
          caption={t('certificatesCaption')}
          columns={[
            { key: 'subject', header: t('certificateColumns.subject'), mobile: 'body', className: 'break-all', cell: (certificate) => certificate.subject },
            { key: 'issuedBy', header: t('certificateColumns.issuedBy'), className: 'break-all text-ink-2', cell: (certificate) => certificate.issued_by },
            { key: 'validTo', header: t('certificateColumns.validTo'), className: 'whitespace-nowrap', cell: (certificate) => <ExpiryLabel date={certificate.not_after} /> },
            {
              key: 'state',
              header: t('certificateColumns.state'),
              mobile: 'badge',
              cell: (certificate) => (
                <Badge size="sm" tone={certificate.active ? 'success' : 'neutral'}>
                  {certificate.active ? t('active') : t('inactive')}
                </Badge>
              ),
            },
          ]}
          framed={false}
          rowKey={(certificate) => certificate.id}
          rows={issuer.certificates}
        />
      )}
      <Dialog description={t('replaceCertificateBody')} onClose={() => setOpen(false)} open={open} title={t('replaceCertificate')}>
        <CertificateForm
          issuerId={issuer.id}
          onLoaded={(certificate) => {
            setOpen(false);
            toast(t('certificateLoaded', { date: formatDate(certificate.not_after, locale) }));
            onChange();
          }}
          submitLabel={t('saveCertificate')}
        />
      </Dialog>
    </Card>
  );
}

/** Software registrations and «Registrar software» (H-13); the PIN is never shown. */
function Software({ issuer, onChange }: { issuer: IssuerDetail; onChange: () => void }) {
  const t = useTranslations('issuerDetail');
  const tEnvironments = useTranslations('operations.environments');
  const [open, setOpen] = useState(false);

  return (
    <Card aria-labelledby="issuer-software">
      <CardHeader
        action={
          <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => setOpen(true)} size="sm" variant="secondary">
            {t('registerSoftware')}
          </Button>
        }
        id="issuer-software"
        title={t('softwareTitle')}
      />
      {issuer.software.length === 0 ? (
        <Notice tone="danger">{t('noSoftware')}</Notice>
      ) : (
        <DataTable
          caption={t('softwareCaption')}
          columns={[
            {
              key: 'environment',
              header: t('softwareColumns.environment'),
              mobile: 'badge',
              cell: (software) => (
                <Badge size="sm" tone={software.environment === '1' ? 'success' : 'pending'}>
                  {tEnvironments(software.environment)}
                </Badge>
              ),
            },
            { key: 'softwareId', header: t('softwareColumns.softwareId'), mobile: 'title', cell: (software) => <span className="break-all font-mono text-[13px]">{software.software_id}</span> },
            { key: 'pin', header: t('softwareColumns.pin'), cell: () => <span className="text-ink-3">{t('pinRegistered')}</span> },
            { key: 'testSet', header: t('softwareColumns.testSet'), cell: (software) => (software.has_test_set ? t('testSetYes') : t('testSetNo')) },
            { key: 'state', header: t('softwareColumns.state'), cell: (software) => (software.active ? t('active') : t('inactive')) },
          ]}
          framed={false}
          rowKey={(software) => `${software.environment}-${software.software_id}`}
          rows={issuer.software}
        />
      )}
      <Dialog description={t('registerSoftwareBody')} onClose={() => setOpen(false)} open={open} title={t('registerSoftware')}>
        <SoftwareFormFields
          issuerId={issuer.id}
          onSaved={() => {
            setOpen(false);
            toast(t('softwareSaved'));
            onChange();
          }}
          submitLabel={t('saveSoftware')}
        />
      </Dialog>
    </Card>
  );
}

/** Ranges with their usage and «Agregar rango» (H-14), including the contingency range (type 03, D5). */
function Ranges({ issuer, onChange }: { issuer: IssuerDetail; onChange: () => void }) {
  const t = useTranslations('issuerDetail');
  const tKinds = useTranslations('operations.rangeKinds');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });

  return (
    <Card aria-labelledby="issuer-ranges">
      <CardHeader
        action={
          <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => setOpen(true)} size="sm" variant="primary">
            {t('addRange')}
          </Button>
        }
        id="issuer-ranges"
        subtitle={t('rangesSubtitle')}
        title={t('rangesTitle')}
      />
      {issuer.ranges.length === 0 ? (
        <Notice tone="danger">{t('noRanges')}</Notice>
      ) : (
        <DataTable<IssuerRange>
          caption={t('rangesCaption')}
          columns={[
            {
              key: 'kind',
              header: t('rangeColumns.kind'),
              mobile: 'badge',
              cell: (range) => (
                <Badge size="sm" tone={range.active ? (range.kind === 'invoice' ? 'primary' : 'warning') : 'neutral'}>
                  {tKinds(range.kind)}
                </Badge>
              ),
            },
            { key: 'resolution', header: t('rangeColumns.resolution'), mobile: 'title', cell: (range) => <span className="font-mono text-[13px]">{range.resolution_number}</span> },
            {
              key: 'numbers',
              header: t('rangeColumns.numbers'),
              mobile: 'body',
              className: 'whitespace-nowrap',
              cell: (range) => (
                <span className="font-mono text-[13px]">
                  {range.prefix}
                  {formatNumber(range.number_from, locale)} – {range.prefix}
                  {formatNumber(range.number_to, locale)}
                </span>
              ),
            },
            {
              key: 'validity',
              header: t('rangeColumns.validity'),
              className: 'whitespace-nowrap',
              cell: (range) => `${formatDate(range.valid_from, locale)} → ${formatDate(range.valid_to, locale)}`,
            },
            {
              key: 'used',
              header: t('rangeColumns.used'),
              className: 'min-w-36',
              cell: (range) => (
                <span className="flex items-center gap-2">
                  <ProgressBar className="w-20" tone={usageTone(range.used_share)} value={range.used_share} />
                  <span className={range.used_share >= 0.9 ? 'font-semibold tabular-nums text-danger-fg' : 'tabular-nums'}>{percent.format(range.used_share)}</span>
                </span>
              ),
            },
            { key: 'last', header: t('rangeColumns.last'), cell: (range) => <span className="font-mono text-[13px]">{range.last_number ?? '—'}</span> },
          ]}
          framed={false}
          rowKey={(range) => range.id}
          rows={issuer.ranges}
        />
      )}
      {issuer.environment === '2' ? <Notice className="mt-4" tone="info">{t('productionRangesHint')}</Notice> : null}
      <Dialog description={t('addRangeBody')} onClose={() => setOpen(false)} open={open} size="lg" title={t('addRange')}>
        <RangeFormFields
          allowKind
          issuerId={issuer.id}
          onSaved={() => {
            setOpen(false);
            toast(t('rangeSaved'));
            onChange();
          }}
          submitLabel={t('saveRange')}
        />
      </Dialog>
    </Card>
  );
}

function ContingencyLetter({ issuerId }: { issuerId: number }) {
  const t = useTranslations('issuerDetail');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await downloadContingencyLetter({ issuerId, from, to });
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  return (
    <Card aria-labelledby="issuer-letter">
      <CardHeader id="issuer-letter" subtitle={t('letterBody')} title={t('letterTitle')} />
      <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => void onSubmit(e)}>
        <Field id="letter-from" label={t('letterFrom')}>
          <Input id="letter-from" onChange={(e) => setFrom(e.target.value)} required type="date" value={from} />
        </Field>
        <Field id="letter-to" label={t('letterTo')}>
          <Input id="letter-to" onChange={(e) => setTo(e.target.value)} required type="date" value={to} />
        </Field>
        <Button icon={<FileText aria-hidden className="size-4" />} loading={status === 'loading'} type="submit" variant="secondary">
          {t('letterSubmit')}
        </Button>
      </form>
      {status === 'error' ? (
        <p className="mt-3 rounded-lg bg-danger-bg px-4 py-2.5 text-[13px] font-semibold text-danger-fg" role="alert">
          {t('letterError')}
        </p>
      ) : null}
    </Card>
  );
}

function ExpiryLabel({ date }: { date: string }) {
  const t = useTranslations('issuerDetail');
  const locale = useLocale();
  const days = daysUntil(date);
  const tone = days === null ? 'neutral' : days < 0 || days <= 7 ? 'danger' : days <= CERTIFICATE_WARNING_DAYS ? 'warning' : null;

  return (
    <span className="flex flex-wrap items-center gap-2">
      {formatDate(date, locale)}
      {tone && days !== null ? (
        <Badge size="sm" tone={tone}>
          {days < 0 ? t('expired') : t('expiresIn', { days })}
        </Badge>
      ) : null}
    </span>
  );
}

/** The test set and production status behind the life cycle; reloaded after every action of the panels. */
function useLifecycleData(issuerId: number) {
  const [testSet, setTestSet] = useState<{ readiness: TestSetReadiness; run: TestSetRun | null } | null>(null);
  const [production, setProduction] = useState<ProductionStatus | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetchTestSet(issuerId)
      .then((data) => active && setTestSet(data ?? null))
      .catch(() => active && setTestSet(null));
    fetchProduction(issuerId)
      .then((data) => active && setProduction(data ?? null))
      .catch(() => active && setProduction(null));
    return () => {
      active = false;
    };
  }, [issuerId, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { testSet, production, reload };
}

function missingForEnrolment(readiness: TestSetReadiness | undefined): ('certificate' | 'software' | 'test_set_id' | 'range')[] {
  if (!readiness) return [];
  return (['certificate', 'software', 'test_set_id', 'range'] as const).filter((key) => !readiness[key]);
}

/**
 * Inscrito → Set aceptado → Habilitado → Producción (H-09). «Habilitado» happens in the DIAN portal: Fiscal. only
 * knows it once the issuer moves to production.
 */
function lifecycleSteps(issuer: IssuerDetail, data: ReturnType<typeof useLifecycleData>, t: ReturnType<typeof useTranslations<'issuerDetail'>>): LifecycleStep[] {
  const inProduction = issuer.environment === '1';
  const enrolled = inProduction || (data.testSet ? missingForEnrolment(data.testSet.readiness).length === 0 : false);
  const run = data.testSet?.run ?? null;
  const setAccepted = inProduction || Boolean(data.production?.readiness.test_set_accepted);
  const accepted = run?.documents.filter((document) => document.status === 'accepted').length ?? 0;

  const setCaption = setAccepted
    ? t('lifecycle.done')
    : run?.state === 'rejected' || run?.state === 'failed'
      ? t('lifecycle.setRejected')
      : run
        ? t('lifecycle.setProgress', { accepted, total: run.documents.length })
        : t('lifecycle.pending');

  return [
    { key: 'enrolled', emoji: 'enrolled', title: t('lifecycle.enrolled'), caption: enrolled ? t('lifecycle.done') : t('lifecycle.missing'), state: enrolled ? 'done' : 'current' },
    {
      key: 'test-set',
      emoji: 'test-set',
      title: t('lifecycle.testSet'),
      caption: setCaption,
      state: setAccepted ? 'done' : !enrolled ? 'pending' : run?.state === 'rejected' || run?.state === 'failed' ? 'problem' : 'current',
    },
    {
      key: 'enabled',
      emoji: 'enabled',
      title: t('lifecycle.enabled'),
      caption: inProduction ? t('lifecycle.done') : setAccepted ? t('lifecycle.inPortal') : t('lifecycle.pending'),
      state: inProduction ? 'done' : setAccepted ? 'current' : 'pending',
    },
    {
      key: 'production',
      emoji: 'production',
      title: t('lifecycle.production'),
      caption: inProduction ? t('lifecycle.live') : t('lifecycle.pending'),
      state: inProduction ? 'done' : 'pending',
    },
  ];
}

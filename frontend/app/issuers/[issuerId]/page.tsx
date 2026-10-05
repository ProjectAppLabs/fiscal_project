'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState, type ReactNode } from 'react';

import { ConsoleLoadError, ConsoleLoading } from '@/components/console/ConsoleStatus';
import { TestSetPanel } from '@/components/console/TestSetPanel';
import { ROUTES, documentDetailRoute } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { downloadContingencyLetter, isAlertKind, type Alert, type IssuerDetail } from '@/lib/services/operations';
import type { DetailStatus } from '@/lib/stores/consoleStore';
import { useOperationsStore } from '@/lib/stores/operationsStore';

const CARD_CLASS = 'rounded-2xl border border-border bg-card p-6';
const INPUT_CLASS =
  'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link className="text-sm hover:underline" href={ROUTES.ISSUERS}>
        ← {t('back')}
      </Link>
      <IssuerBody issuer={issuer} status={status} onRetry={() => void loadIssuer(issuerId)} />
    </main>
  );
}

function IssuerBody({ issuer, status, onRetry }: { issuer: IssuerDetail | null; status: DetailStatus; onRetry: () => void }) {
  const t = useTranslations('issuerDetail');

  if (status === 'not-found') {
    return (
      <section className="mt-10 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">{t('notFoundTitle')}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('notFoundBody')}</p>
      </section>
    );
  }
  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={onRetry} />;
  if (!issuer) return <ConsoleLoading />;

  return (
    <div className="mt-6 space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{issuer.legal_name}</h1>
      <IssuerData issuer={issuer} />
      <IssuerAlerts alerts={issuer.alerts} />
      <Certificates issuer={issuer} />
      <Software issuer={issuer} />
      <Ranges issuer={issuer} />
      <TestSetPanel issuerId={issuer.id} />
      <ContingencyLetter issuerId={issuer.id} />
    </div>
  );
}

function IssuerData({ issuer }: { issuer: IssuerDetail }) {
  const t = useTranslations('issuerDetail');
  const tEnvironments = useTranslations('operations.environments');

  return (
    <section className={CARD_CLASS} aria-labelledby="issuer-data">
      <h2 className="text-lg font-semibold" id="issuer-data">
        {t('dataTitle')}
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t('fields.nit')}>
          {issuer.nit}-{issuer.dv}
        </Field>
        <Field label={t('fields.environment')}>{tEnvironments(issuer.environment)}</Field>
        <Field label={t('fields.client')}>{issuer.client}</Field>
        <Field label={t('fields.personType')}>{t(`personTypes.${issuer.person_type}`)}</Field>
        <Field label={t('fields.responsibilities')}>{issuer.tax_responsibilities.join(', ') || '—'}</Field>
        <Field label={t('fields.email')}>{issuer.email}</Field>
        <Field label={t('fields.address')}>
          {issuer.address.line} · DANE {issuer.address.municipality_code}
        </Field>
      </dl>
    </section>
  );
}

function IssuerAlerts({ alerts }: { alerts: Alert[] }) {
  const t = useTranslations('issuerDetail');
  const tKinds = useTranslations('operations.alertKinds');

  return (
    <section className={CARD_CLASS} aria-labelledby="issuer-alerts">
      <h2 className="text-lg font-semibold" id="issuer-alerts">
        {t('alertsTitle')}
      </h2>
      {alerts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('noAlerts')}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {alerts.map((alert) => (
            <li className={alert.severity === 'critical' ? 'text-destructive' : ''} key={alert.id}>
              <span className="font-medium">{isAlertKind(alert.kind) ? tKinds(alert.kind) : alert.kind}:</span>{' '}
              {alert.message}
              {alert.document ? (
                <>
                  {' '}
                  <Link className="underline" href={documentDetailRoute(alert.document.id)}>
                    {alert.document.full_number}
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Certificates({ issuer }: { issuer: IssuerDetail }) {
  const t = useTranslations('issuerDetail');
  const locale = useLocale();

  return (
    <section className={CARD_CLASS} aria-labelledby="issuer-certificates">
      <h2 className="text-lg font-semibold" id="issuer-certificates">
        {t('certificatesTitle')}
      </h2>
      {issuer.certificates.length === 0 ? (
        <p className="mt-3 text-sm text-destructive">{t('noCertificates')}</p>
      ) : (
        <Table caption={t('certificatesCaption')} headers={[t('certificateColumns.subject'), t('certificateColumns.issuedBy'), t('certificateColumns.validTo'), t('certificateColumns.state')]}>
          {issuer.certificates.map((certificate) => (
            <tr className="border-b border-border last:border-0" key={certificate.id}>
              <td className="py-2 pr-4 break-all">{certificate.subject}</td>
              <td className="py-2 pr-4 break-all">{certificate.issued_by}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(certificate.not_after, locale)}</td>
              <td className="py-2">{certificate.active ? t('active') : t('inactive')}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}

function Software({ issuer }: { issuer: IssuerDetail }) {
  const t = useTranslations('issuerDetail');
  const tEnvironments = useTranslations('operations.environments');

  return (
    <section className={CARD_CLASS} aria-labelledby="issuer-software">
      <h2 className="text-lg font-semibold" id="issuer-software">
        {t('softwareTitle')}
      </h2>
      {issuer.software.length === 0 ? (
        <p className="mt-3 text-sm text-destructive">{t('noSoftware')}</p>
      ) : (
        <Table caption={t('softwareCaption')} headers={[t('softwareColumns.environment'), t('softwareColumns.softwareId'), t('softwareColumns.testSet'), t('softwareColumns.state')]}>
          {issuer.software.map((software) => (
            <tr className="border-b border-border last:border-0" key={`${software.environment}-${software.software_id}`}>
              <td className="py-2 pr-4">{tEnvironments(software.environment)}</td>
              <td className="py-2 pr-4 font-mono break-all">{software.software_id}</td>
              <td className="py-2 pr-4">{software.has_test_set ? t('testSetYes') : t('testSetNo')}</td>
              <td className="py-2">{software.active ? t('active') : t('inactive')}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}

function Ranges({ issuer }: { issuer: IssuerDetail }) {
  const t = useTranslations('issuerDetail');
  const tKinds = useTranslations('operations.rangeKinds');
  const locale = useLocale();
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });

  return (
    <section className={CARD_CLASS} aria-labelledby="issuer-ranges">
      <h2 className="text-lg font-semibold" id="issuer-ranges">
        {t('rangesTitle')}
      </h2>
      {issuer.ranges.length === 0 ? (
        <p className="mt-3 text-sm text-destructive">{t('noRanges')}</p>
      ) : (
        <Table
          caption={t('rangesCaption')}
          headers={[t('rangeColumns.kind'), t('rangeColumns.resolution'), t('rangeColumns.numbers'), t('rangeColumns.validity'), t('rangeColumns.used'), t('rangeColumns.last')]}
        >
          {issuer.ranges.map((range) => (
            <tr className="border-b border-border last:border-0" key={range.id}>
              <td className="py-2 pr-4">{tKinds(range.kind)}</td>
              <td className="py-2 pr-4 font-mono">{range.resolution_number}</td>
              <td className="py-2 pr-4 font-mono whitespace-nowrap">
                {range.prefix}
                {range.number_from} – {range.prefix}
                {range.number_to}
              </td>
              <td className="py-2 pr-4 whitespace-nowrap">
                {range.valid_from} → {range.valid_to}
              </td>
              <td className={`py-2 pr-4 tabular-nums ${range.used_share >= 0.9 ? 'text-destructive' : ''}`}>
                {percent.format(range.used_share)}
              </td>
              <td className="py-2 font-mono">{range.last_number ?? '—'}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
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
    <section className={CARD_CLASS} aria-labelledby="issuer-letter">
      <h2 className="text-lg font-semibold" id="issuer-letter">
        {t('letterTitle')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('letterBody')}</p>
      <form className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <label className="mb-1 block text-sm" htmlFor="letter-from">
            {t('letterFrom')}
          </label>
          <input id="letter-from" className={INPUT_CLASS} required type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm" htmlFor="letter-to">
            {t('letterTo')}
          </label>
          <input id="letter-to" className={INPUT_CLASS} required type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button
          className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={status === 'loading'}
          type="submit"
        >
          {t('letterSubmit')}
        </button>
      </form>
      {status === 'error' ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {t('letterError')}
        </p>
      ) : null}
    </section>
  );
}

function Table({ caption, headers, children }: { caption: string; headers: string[]; children: ReactNode }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th className="py-2 pr-4 font-medium" key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import { ConsoleLoadError, ConsoleLoading, DocumentStateBadge } from '@/components/console/ConsoleStatus';
import { ROUTES, documentDetailRoute } from '@/lib/constants';
import { formatBytes, formatDateTime, shortHash } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import {
  describeDianError,
  eventDetailParts,
  isDianNotification,
  type DocumentDetail,
  type DocumentEvent,
} from '@/lib/services/console';
import { ARTIFACT_KINDS, artifactFileName, downloadArtifact, type ArtifactKind } from '@/lib/services/operations';
import { useConsoleStore, type DetailStatus } from '@/lib/stores/consoleStore';

const CARD_CLASS = 'rounded-2xl border border-border bg-card p-6';

export default function DocumentDetailPage() {
  const t = useTranslations('documentDetail');
  const { documentId } = useParams<{ documentId: string }>();
  const { isAuthenticated } = useRequireAuth();
  const document = useConsoleStore((s) => s.document);
  const status = useConsoleStore((s) => s.documentStatus);
  const loadDocument = useConsoleStore((s) => s.loadDocument);

  useEffect(() => {
    if (isAuthenticated) void loadDocument(documentId);
  }, [isAuthenticated, documentId, loadDocument]);

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link className="text-sm hover:underline" href={ROUTES.DOCUMENTS}>
        ← {t('back')}
      </Link>
      <DetailBody
        document={document}
        status={status}
        onRetry={() => void loadDocument(documentId)}
      />
    </main>
  );
}

function DetailBody({
  document,
  status,
  onRetry,
}: {
  document: DocumentDetail | null;
  status: DetailStatus;
  onRetry: () => void;
}) {
  const t = useTranslations('documentDetail');

  if (status === 'not-found') {
    return (
      <section className="mt-10 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">{t('notFoundTitle')}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('notFoundBody')}</p>
      </section>
    );
  }
  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={onRetry} />;
  if (!document) return <ConsoleLoading />;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-3xl font-semibold tracking-tight">{document.full_number}</h1>
        <DocumentStateBadge state={document.state} />
      </div>
      <DocumentData document={document} />
      <DianErrors document={document} />
      <Artifacts document={document} />
      <Events document={document} />
      <details className={CARD_CLASS}>
        <summary className="cursor-pointer text-lg font-semibold">{t('payloadTitle')}</summary>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-4 text-xs">{JSON.stringify(document.payload, null, 2)}</pre>
      </details>
    </div>
  );
}

function DocumentData({ document }: { document: DocumentDetail }) {
  const t = useTranslations('documentDetail');
  const tConsole = useTranslations('console');
  const tKinds = useTranslations('console.kinds');
  const tStates = useTranslations('console.state');
  const locale = useLocale();

  return (
    <section className={CARD_CLASS} aria-labelledby="document-data">
      <h2 className="text-lg font-semibold" id="document-data">
        {t('dataTitle')}
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t('fields.kind')}>{tKinds(document.kind)}</Field>
        <Field label={t('fields.state')}>{tStates(document.state)}</Field>
        <Field label={t('fields.issuer')}>
          {tConsole('issuer', { name: document.issuer.legal_name, nit: document.issuer.nit })}
        </Field>
        <Field label={t('fields.client')}>{document.client}</Field>
        <Field label={t('fields.attempts')}>{document.attempts}</Field>
        <Field label={t('fields.idempotencyKey')}>
          <span className="font-mono break-all">{document.idempotency_key}</span>
        </Field>
        <Field label={t('fields.issued')}>{formatDateTime(document.issue_datetime, locale)}</Field>
        <Field label={t('fields.created')}>{formatDateTime(document.created_at, locale)}</Field>
        <Field label={t('fields.validated')}>{formatDateTime(document.validated_at, locale)}</Field>
        {document.original ? (
          <Field label={t('fields.original')}>
            <Link className="hover:underline" href={documentDetailRoute(document.original)}>
              {t('viewOriginal', { id: document.original })}
            </Link>
          </Field>
        ) : null}
        {document.invoice_type ? (
          <Field label={t('fields.invoiceType')}>{invoiceTypeLabel(document.invoice_type, t)}</Field>
        ) : null}
        {document.contingency_started_at ? (
          <Field label={t('fields.contingencyStarted')}>{formatDateTime(document.contingency_started_at, locale)}</Field>
        ) : null}
        {document.cufe ? (
          <Field label={t('fields.cufe')}>
            <span className="font-mono text-xs break-all">{document.cufe}</span>
          </Field>
        ) : null}
      </dl>
      {document.qr_url ? (
        <a
          className="mt-4 inline-block text-sm hover:underline"
          href={document.qr_url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('qr')}
        </a>
      ) : null}
    </section>
  );
}

function DianErrors({ document }: { document: DocumentDetail }) {
  const t = useTranslations('documentDetail');

  return (
    <section className={CARD_CLASS} aria-labelledby="document-errors">
      <h2 className="text-lg font-semibold" id="document-errors">
        {t('errorsTitle')}
      </h2>
      {document.errors.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('noErrors')}</p>
      ) : (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {document.errors.map((error, index) =>
            isDianNotification(error) ? (
              <li className="text-muted-foreground" key={index}>
                {t('notification')}: {describeDianError(error)}
              </li>
            ) : (
              <li className="text-destructive" key={index}>
                {describeDianError(error)}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function Artifacts({ document }: { document: DocumentDetail }) {
  const t = useTranslations('documentDetail');
  const tArtifacts = useTranslations('operations.artifactKinds');
  const locale = useLocale();

  return (
    <section className={CARD_CLASS} aria-labelledby="document-artifacts">
      <h2 className="text-lg font-semibold" id="document-artifacts">
        {t('artifactsTitle')}
      </h2>
      {document.artifacts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('noArtifacts')}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t('artifactsCaption')}</caption>
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium" scope="col">{t('artifactColumns.kind')}</th>
                <th className="py-2 pr-4 font-medium" scope="col">{t('artifactColumns.size')}</th>
                <th className="py-2 pr-4 font-medium" scope="col">{t('artifactColumns.sha256')}</th>
                <th className="py-2 pr-4 font-medium" scope="col">{t('artifactColumns.created')}</th>
                <th className="py-2 font-medium" scope="col">{t('artifactColumns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {document.artifacts.map((artifact) => (
                <tr className="border-b border-border last:border-0" key={`${artifact.kind}-${artifact.sha256}`}>
                  <td className="py-2 pr-4">{isArtifactKind(artifact.kind) ? tArtifacts(artifact.kind) : artifact.kind}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatBytes(artifact.size, locale)}</td>
                  <td className="py-2 pr-4 font-mono" title={artifact.sha256}>
                    {shortHash(artifact.sha256)}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(artifact.created_at, locale)}</td>
                  <td className="py-2">
                    {isArtifactKind(artifact.kind) ? (
                      <DownloadButton documentId={document.id} fullNumber={document.full_number} kind={artifact.kind} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Events({ document }: { document: DocumentDetail }) {
  const t = useTranslations('documentDetail');
  const locale = useLocale();

  return (
    <section className={CARD_CLASS} aria-labelledby="document-events">
      <h2 className="text-lg font-semibold" id="document-events">
        {t('eventsTitle')}
      </h2>
      {document.events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('noEvents')}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {document.events.map((event, index) => (
            <li className="flex flex-wrap items-baseline gap-3 text-sm" key={`${event.created_at}-${index}`}>
              <DocumentStateBadge state={event.state} />
              <time className="text-muted-foreground" dateTime={event.created_at}>
                {formatDateTime(event.created_at, locale)}
              </time>
              <EventDetail detail={event.detail} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function EventDetail({ detail }: { detail: DocumentEvent['detail'] }) {
  const t = useTranslations('documentDetail.eventKeys');
  const parts = eventDetailParts(detail);
  if (parts.length === 0) return null;

  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {parts.map((part) => (
        <span key={part.key}>
          {part.key === 'text' ? part.value : `${t(part.key)}: ${part.value}`}
        </span>
      ))}
    </span>
  );
}

function DownloadButton({ documentId, fullNumber, kind }: { documentId: number; fullNumber: string; kind: ArtifactKind }) {
  const t = useTranslations('documentDetail');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const onClick = async () => {
    setStatus('loading');
    try {
      await downloadArtifact({ documentId, kind, fileName: artifactFileName(fullNumber, kind) });
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        disabled={status === 'loading'}
        onClick={() => void onClick()}
        type="button"
      >
        {t('download')}
      </button>
      {status === 'error' ? (
        <span className="text-xs text-destructive" role="alert">
          {t('downloadError')}
        </span>
      ) : null}
    </span>
  );
}

function invoiceTypeLabel(code: string, t: ReturnType<typeof useTranslations<'documentDetail'>>): string {
  return INVOICE_TYPES.includes(code as (typeof INVOICE_TYPES)[number]) ? t(`invoiceTypes.${code as (typeof INVOICE_TYPES)[number]}`) : code;
}

function isArtifactKind(kind: string): kind is ArtifactKind {
  return (ARTIFACT_KINDS as readonly string[]).includes(kind);
}

const INVOICE_TYPES = ['01', '03', '04'] as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

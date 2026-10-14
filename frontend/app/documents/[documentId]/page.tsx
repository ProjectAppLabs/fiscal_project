'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { BellRing, Download, ExternalLink, SearchCheck, Send } from 'lucide-react';

import { ConsoleLoadError, DocumentStateBadge } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, DataItem, DataList } from '@/components/ui/Card';
import { CodeValue } from '@/components/ui/Copy';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { JsonViewer } from '@/components/ui/JsonViewer';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotFoundState, SkeletonCard } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { ROUTES, documentDetailRoute } from '@/lib/constants';
import { formatBytes, formatDateTime, shortHash } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import {
  describeDianError,
  eventDetailParts,
  isDianNotification,
  type DocumentArtifact,
  type DocumentDetail,
  type DocumentEvent,
} from '@/lib/services/console';
import { stepErrors } from '@/lib/services/onboarding';
import { ARTIFACT_KINDS, artifactFileName, downloadArtifact, type ArtifactKind } from '@/lib/services/operations';
import { runDocumentAction, type DianAnswer, type DocumentAction } from '@/lib/services/support';
import { useConsoleStore, type DetailStatus } from '@/lib/stores/consoleStore';
import { HandoffCard } from '@/components/console/HandoffCard';

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
    <Page>
      <Link className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-primary-text" href={ROUTES.DOCUMENTS}>
        ← {t('back')}
      </Link>
      <DetailBody document={document} onRetry={() => void loadDocument(documentId)} status={status} />
    </Page>
  );
}

function DetailBody({ document, status, onRetry }: { document: DocumentDetail | null; status: DetailStatus; onRetry: () => void }) {
  const t = useTranslations('documentDetail');
  const tKinds = useTranslations('console.kinds');

  if (status === 'not-found') return <NotFoundState body={t('notFoundBody')} title={t('notFoundTitle')} />;
  if (status === 'error') return <ConsoleLoadError message={t('error')} onRetry={onRetry} />;
  if (!document) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={6} />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="appear">
      <PageHeader
        actions={<SupportActions document={document} />}
        badge={<DocumentStateBadge size="lg" state={document.state} />}
        breadcrumb={[{ label: t('breadcrumb'), href: ROUTES.DOCUMENTS }, { label: tKinds(document.kind) }]}
        emoji="documents"
        subtitle={`${document.issuer.legal_name} · NIT ${document.issuer.nit}`}
        title={<span className="font-mono tracking-[-0.03em]">{document.full_number}</span>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <DocumentData document={document} />
        <div className="flex flex-col gap-4">
          <DianAnswer document={document} />
          {document.state === 'rejected' ? <HandoffCard guides={['rejection']} issuer={document.issuer} /> : null}
          <Events document={document} />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <Artifacts document={document} />
        <JsonViewer
          fileName={`${document.full_number}.json`}
          subtitle={t('payloadSubtitle', { client: document.client })}
          title={t('payloadTitle')}
          value={document.payload}
        />
      </div>
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
    <Card aria-labelledby="document-data">
      <CardHeader
        action={
          document.qr_url ? (
            <a className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-text hover:underline" href={document.qr_url} rel="noopener noreferrer" target="_blank">
              {t('qr')}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          ) : null
        }
        id="document-data"
        title={t('dataTitle')}
      />
      <DataList>
        <DataItem label={t('fields.kind')}>{tKinds(document.kind)}</DataItem>
        <DataItem label={t('fields.state')}>{tStates(document.state)}</DataItem>
        <DataItem label={t('fields.issuer')}>{tConsole('issuer', { name: document.issuer.legal_name, nit: document.issuer.nit })}</DataItem>
        <DataItem label={t('fields.client')}>{document.client}</DataItem>
        <DataItem label={t('fields.attempts')}>{document.attempts}</DataItem>
        <DataItem label={t('fields.idempotencyKey')}>
          <span className="break-all font-mono text-[13px]">{document.idempotency_key}</span>
        </DataItem>
        <DataItem label={t('fields.issued')}>{formatDateTime(document.issue_datetime, locale)}</DataItem>
        <DataItem label={t('fields.created')}>{formatDateTime(document.created_at, locale)}</DataItem>
        <DataItem label={t('fields.validated')}>{formatDateTime(document.validated_at, locale)}</DataItem>
        {document.original ? (
          <DataItem label={t('fields.original')}>
            <Link className="font-semibold text-primary-text hover:underline" href={documentDetailRoute(document.original)}>
              {t('viewOriginal', { id: document.original })}
            </Link>
          </DataItem>
        ) : null}
        {document.invoice_type ? <DataItem label={t('fields.invoiceType')}>{invoiceTypeLabel(document.invoice_type, t)}</DataItem> : null}
        {document.contingency_started_at ? (
          <DataItem label={t('fields.contingencyStarted')}>{formatDateTime(document.contingency_started_at, locale)}</DataItem>
        ) : null}
        {document.notes?.length ? (
          <DataItem label={t('fields.notes')}>
            <span className="flex flex-wrap gap-2">
              {document.notes.map((note) => (
                <Link className="font-mono text-[13px] font-medium text-primary-text hover:underline" href={documentDetailRoute(note.id)} key={note.id}>
                  {note.full_number}
                </Link>
              ))}
            </span>
          </DataItem>
        ) : null}
        {document.cufe ? (
          <DataItem label={t('fields.cufe')}>
            <CodeValue label={t('copyCufe')} value={document.cufe} />
          </DataItem>
        ) : null}
      </DataList>
    </Card>
  );
}

/** Rejections in rose and notifications in grey, apart: a notification never stops a document. */
function DianAnswer({ document }: { document: DocumentDetail }) {
  const t = useTranslations('documentDetail');
  const rejections = document.errors.filter((error) => !isDianNotification(error));
  const notifications = document.errors.filter(isDianNotification);

  return (
    <Card aria-labelledby="document-errors">
      <CardHeader id="document-errors" title={t('errorsTitle')} />
      {document.errors.length === 0 ? <p className="text-[15px] text-ink-2">{t('noErrors')}</p> : null}
      {rejections.length ? (
        <div>
          <p className="text-label mb-2">{t('rejections')}</p>
          <ul className="flex flex-col gap-2">
            {rejections.map((error, index) => (
              <li className="rounded-lg bg-danger-bg px-4 py-2.5 font-mono text-[13px] text-danger-fg" key={index}>
                {describeDianError(error)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {notifications.length ? (
        <div className={rejections.length ? 'mt-4' : undefined}>
          <p className="text-label mb-2">{t('notifications')}</p>
          <ul className="flex flex-col gap-2">
            {notifications.map((error, index) => (
              <li className="rounded-lg bg-neutral-bg px-4 py-2.5 font-mono text-[13px] text-neutral-fg" key={index}>
                <span className="sr-only">{t('notification')}: </span>
                {describeDianError(error)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function Artifacts({ document }: { document: DocumentDetail }) {
  const t = useTranslations('documentDetail');
  const tArtifacts = useTranslations('operations.artifactKinds');
  const locale = useLocale();

  return (
    <Card aria-labelledby="document-artifacts">
      <CardHeader id="document-artifacts" subtitle={t('artifactsSubtitle')} title={t('artifactsTitle')} />
      {document.artifacts.length === 0 ? (
        <p className="text-[15px] text-ink-2">{t('noArtifacts')}</p>
      ) : (
        <DataTable<DocumentArtifact>
          caption={t('artifactsCaption')}
          columns={[
            { key: 'kind', header: t('artifactColumns.kind'), mobile: 'body', cell: (artifact) => (isArtifactKind(artifact.kind) ? tArtifacts(artifact.kind) : artifact.kind) },
            { key: 'size', header: t('artifactColumns.size'), className: 'tabular-nums', cell: (artifact) => formatBytes(artifact.size, locale) },
            {
              key: 'sha256',
              header: t('artifactColumns.sha256'),
              mobile: 'hidden',
              cell: (artifact) => (
                <span className="font-mono text-[13px] text-ink-2" title={artifact.sha256}>
                  {shortHash(artifact.sha256)}
                </span>
              ),
            },
            { key: 'created', header: t('artifactColumns.created'), className: 'whitespace-nowrap', cell: (artifact) => formatDateTime(artifact.created_at, locale) },
            {
              key: 'actions',
              header: t('artifactColumns.actions'),
              mobile: 'action',
              align: 'end',
              cell: (artifact) =>
                isArtifactKind(artifact.kind) ? <DownloadButton documentId={document.id} fullNumber={document.full_number} kind={artifact.kind} /> : null,
            },
          ]}
          framed={false}
          rowKey={(artifact) => `${artifact.kind}-${artifact.sha256}`}
          rows={document.artifacts}
        />
      )}
    </Card>
  );
}

function Events({ document }: { document: DocumentDetail }) {
  const t = useTranslations('documentDetail');
  const locale = useLocale();

  return (
    <Card aria-labelledby="document-events">
      <CardHeader id="document-events" title={t('eventsTitle')} />
      {document.events.length === 0 ? (
        <p className="text-[15px] text-ink-2">{t('noEvents')}</p>
      ) : (
        <ol className="relative flex flex-col gap-4 border-l-2 border-line pl-5">
          {document.events.map((event, index) => (
            <li className="relative" key={`${event.created_at}-${index}`}>
              <span aria-hidden className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-surface shadow-[0_0_0_3px_var(--focus)]" />
              <div className="flex flex-wrap items-center gap-2">
                <DocumentStateBadge state={event.state} />
                <time className="text-[13px] text-ink-3" dateTime={event.created_at}>
                  {formatDateTime(event.created_at, locale)}
                </time>
              </div>
              <EventDetail detail={event.detail} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function EventDetail({ detail }: { detail: DocumentEvent['detail'] }) {
  const t = useTranslations('documentDetail.eventKeys');
  const parts = eventDetailParts(detail);
  if (parts.length === 0) return null;

  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-2">
      {parts.map((part) => (
        <span key={part.key}>{part.key === 'text' ? part.value : `${t(part.key)}: ${part.value}`}</span>
      ))}
    </p>
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
      toast(t('downloadError'), 'error');
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Button icon={<Download aria-hidden className="size-3.5" />} loading={status === 'loading'} onClick={() => void onClick()} size="sm" variant="secondary">
        {t('download')}
      </Button>
      {status === 'error' ? (
        <span role="alert">
          <Badge size="sm" tone="danger">
            {t('downloadError')}
          </Badge>
        </span>
      ) : null}
    </span>
  );
}

/**
 * Support on one document (H-28): put it first in the queue, ask the DIAN what it knows, send the notice again. Each
 * action stays in the document's history.
 */
function SupportActions({ document }: { document: DocumentDetail }) {
  const t = useTranslations('documentDetail');
  const refreshDocument = useConsoleStore((s) => s.refreshDocument);
  const [busy, setBusy] = useState<DocumentAction | null>(null);
  const [answer, setAnswer] = useState<DianAnswer | null>(null);

  const run = async (action: DocumentAction) => {
    setBusy(action);
    try {
      const result = await runDocumentAction(document.id, action);
      if (action === 'check-dian') setAnswer(result as unknown as DianAnswer);
      else toast(action === 'transmit' ? t('actions.transmitted') : result.delivered ? t('actions.noticeDelivered') : t('actions.noticeFailed', { error: String(result.last_error || '—') }), action === 'resend-notice' && !result.delivered ? 'error' : 'success');
      void refreshDocument(String(document.id));
    } catch (error) {
      toast(stepErrors(error)[0] ?? t('actions.failed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const transmittable = document.state === 'queued' || document.state === 'contingency_dian';
  return (
    <>
      {transmittable ? (
        <Button icon={<Send aria-hidden className="size-4" />} loading={busy === 'transmit'} onClick={() => void run('transmit')} variant="primary">
          {t('actions.transmit')}
        </Button>
      ) : null}
      {document.cufe ? (
        <Button icon={<SearchCheck aria-hidden className="size-4" />} loading={busy === 'check-dian'} onClick={() => void run('check-dian')} variant="secondary">
          {t('actions.checkDian')}
        </Button>
      ) : null}
      <Button icon={<BellRing aria-hidden className="size-4" />} loading={busy === 'resend-notice'} onClick={() => void run('resend-notice')} variant="ghost">
        {t('actions.resendNotice')}
      </Button>
      <Dialog description={t('actions.dianBody')} onClose={() => setAnswer(null)} open={answer !== null} title={t('actions.dianTitle')}>
        {answer ? (
          <div className="flex flex-col gap-3">
            <Notice tone={answer.is_valid ? 'success' : 'warning'} title={answer.is_valid ? t('actions.dianValid') : t('actions.dianNotValid')}>
              {answer.status_description || answer.status_code}
            </Notice>
            {answer.messages.length ? (
              <ul className="flex flex-col gap-2">
                {answer.messages.map((message, index) => (
                  <li className="rounded-lg bg-surface-sunk/70 px-4 py-2.5 font-mono text-[13px] text-ink-2" key={index}>
                    {message.rule}: {message.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

function invoiceTypeLabel(code: string, t: ReturnType<typeof useTranslations<'documentDetail'>>): string {
  return INVOICE_TYPES.includes(code as (typeof INVOICE_TYPES)[number]) ? t(`invoiceTypes.${code as (typeof INVOICE_TYPES)[number]}`) : code;
}

function isArtifactKind(kind: string): kind is ArtifactKind {
  return (ARTIFACT_KINDS as readonly string[]).includes(kind);
}

const INVOICE_TYPES = ['01', '03', '04'] as const;

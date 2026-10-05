'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';

import { formatDateTime } from '@/lib/format';
import {
  DEFAULT_TEST_SET_INVOICES,
  checkTestSet,
  fetchTestSet,
  startTestSet,
  stepErrors,
  type TestSetReadiness,
  type TestSetRun,
} from '@/lib/services/onboarding';

const CARD_CLASS = 'rounded-2xl border border-border bg-card p-6';
const BUTTON_CLASS =
  'rounded-full border border-border px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const READINESS_KEYS = ['environment', 'certificate', 'software', 'test_set_id', 'range'] as const;
const STATE_TONE: Record<TestSetRun['state'], string> = {
  processing: 'text-foreground',
  accepted: 'text-success',
  rejected: 'text-destructive',
  failed: 'text-destructive',
};

export function TestSetPanel({ issuerId }: { issuerId: number }) {
  const t = useTranslations('testSet');
  const tKinds = useTranslations('console.kinds');
  const locale = useLocale();
  const [readiness, setReadiness] = useState<TestSetReadiness | null>(null);
  const [run, setRun] = useState<TestSetRun | null>(null);
  const [invoices, setInvoices] = useState(DEFAULT_TEST_SET_INVOICES);
  const [busy, setBusy] = useState<'start' | 'check' | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchTestSet(issuerId)
      .then((data) => {
        if (!active) return;
        setReadiness(data.readiness ?? null);
        setRun(data.run ?? null);
      })
      .catch((error: unknown) => {
        if (active) setErrors(stepErrors(error));
      });
    return () => {
      active = false;
    };
  }, [issuerId]);

  const act = async (kind: 'start' | 'check', action: () => Promise<TestSetRun>) => {
    setBusy(kind);
    setErrors(null);
    try {
      setRun(await action());
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setBusy(null);
    }
  };

  const ready = readiness !== null && READINESS_KEYS.every((key) => readiness[key]);

  return (
    <section aria-labelledby="issuer-test-set" className={CARD_CLASS}>
      <h2 className="text-lg font-semibold" id="issuer-test-set">
        {t('title')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('body')}</p>

      {readiness ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium">{t('readinessTitle')}</h3>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {READINESS_KEYS.map((key) => (
              <li className={readiness[key] ? 'text-success' : 'text-destructive'} key={key}>
                {readiness[key] ? '✓' : '✗'} {t(`readiness.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void act('start', () => startTestSet(issuerId, invoices));
        }}
      >
        <div>
          <label className="mb-1 block text-sm" htmlFor="test-set-invoices">
            {t('invoices')}
          </label>
          <input
            id="test-set-invoices"
            className="w-24 rounded-xl border border-border bg-card px-3 py-2 text-sm"
            max={100}
            min={1}
            type="number"
            value={invoices}
            onChange={(e) => setInvoices(Number(e.target.value))}
          />
        </div>
        <button className={BUTTON_CLASS} disabled={!ready || busy !== null || run?.state === 'processing'} type="submit">
          {busy === 'start' ? t('starting') : t('start')}
        </button>
        {run && run.state === 'processing' ? (
          <button className={BUTTON_CLASS} disabled={busy !== null} onClick={() => void act('check', () => checkTestSet(run.id))} type="button">
            {busy === 'check' ? t('checking') : t('check')}
          </button>
        ) : null}
      </form>

      {errors ? (
        <div className="mt-3 text-sm text-destructive" role="alert">
          <p>{t('error')}</p>
          <ul className="list-disc pl-5">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {run ? (
        <div className="mt-6">
          <p className={`text-base font-semibold ${STATE_TONE[run.state]}`}>
            {t(`states.${run.state}`)} · {formatDateTime(run.updated_at, locale)}
          </p>
          {run.error ? <p className="mt-1 text-sm text-destructive">{run.error}</p> : null}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('tableCaption')}</caption>
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium" scope="col">{t('columns.document')}</th>
                  <th className="py-2 pr-4 font-medium" scope="col">{t('columns.kind')}</th>
                  <th className="py-2 pr-4 font-medium" scope="col">{t('columns.status')}</th>
                  <th className="py-2 font-medium" scope="col">{t('columns.messages')}</th>
                </tr>
              </thead>
              <tbody>
                {run.documents.map((document) => (
                  <tr className="border-b border-border last:border-0" key={document.code}>
                    <td className="py-2 pr-4 font-mono">{document.full_number}</td>
                    <td className="py-2 pr-4">{tKinds(document.kind)}</td>
                    <td className={`py-2 pr-4 ${document.status === 'rejected' ? 'text-destructive' : document.status === 'accepted' ? 'text-success' : ''}`}>
                      {t(`docStatus.${document.status}`)}
                    </td>
                    <td className="py-2">
                      {document.messages.map((message) => `${message.rule}: ${message.message}`).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">{t('noRun')}</p>
      )}
    </section>
  );
}

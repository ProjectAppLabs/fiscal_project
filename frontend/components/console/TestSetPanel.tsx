'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Field, Input } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { RequirementList } from '@/components/ui/Steps';
import { formatDateTime } from '@/lib/format';
import {
  DEFAULT_TEST_SET_SIZE,
  checkTestSet,
  fetchTestSet,
  startTestSet,
  stepErrors,
  type TestSetDocument,
  type TestSetReadiness,
  type TestSetRun,
  type TestSetSize,
} from '@/lib/services/onboarding';
import { StepErrors } from './ClientSystemForm';

const READINESS_KEYS = ['environment', 'certificate', 'software', 'test_set_id', 'range'] as const;
const SIZE_FIELDS = ['invoices', 'credit_notes', 'debit_notes'] as const;
const STATE_TONE: Record<TestSetRun['state'], BadgeTone> = { processing: 'info', accepted: 'success', rejected: 'danger', failed: 'danger' };
const DOC_TONE: Record<TestSetDocument['status'], BadgeTone> = { pending: 'pending', accepted: 'success', rejected: 'danger' };

/**
 * The DIAN test set (H-17): progress, what the issuer lacks, the sizes of the TestSetId, the DIAN's rules grouped (the
 * same notice on 30 invoices reads once) and, folded, every document.
 */
export function TestSetPanel({ issuerId, onChange }: { issuerId: number; onChange?: () => void }) {
  const t = useTranslations('testSet');
  const locale = useLocale();
  const [readiness, setReadiness] = useState<TestSetReadiness | null>(null);
  const [run, setRun] = useState<TestSetRun | null>(null);
  const [size, setSize] = useState<TestSetSize>({ ...DEFAULT_TEST_SET_SIZE });
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
      onChange?.();
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setBusy(null);
    }
  };

  const ready = readiness !== null && READINESS_KEYS.every((key) => readiness[key]);
  const accepted = run?.documents.filter((document) => document.status === 'accepted').length ?? 0;
  const total = run?.documents.length ?? 0;
  return (
    <Card aria-labelledby="issuer-test-set">
      <CardHeader
        action={run ? <Badge tone={STATE_TONE[run.state]}>{t(`states.${run.state}`)}</Badge> : null}
        id="issuer-test-set"
        subtitle={run ? t('lastRun', { date: formatDateTime(run.updated_at, locale) }) : t('body')}
        title={t('title')}
      />

      {run && total ? (
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px] font-semibold">
            <span className="text-ink">{t('progress', { accepted, total })}</span>
            <span className="tabular-nums text-ink-2">{Math.round((accepted / total) * 100)} %</span>
          </div>
          <ProgressBar label={t('progress', { accepted, total })} value={accepted / total} />
        </div>
      ) : null}

      {readiness ? (
        <div className="mb-5">
          <h3 className="text-label mb-2">{t('readinessTitle')}</h3>
          <RequirementList className="sm:grid sm:grid-cols-2" items={READINESS_KEYS.map((key) => ({ key, ok: readiness[key], label: t(`readiness.${key}`) }))} />
        </div>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void act('start', () => startTestSet(issuerId, size));
        }}
      >
        {SIZE_FIELDS.map((field) => (
          <Field className="w-28" id={`test-set-${field}`} key={field} label={t(`size.${field}`)}>
            <Input
              className="h-11 font-mono"
              id={`test-set-${field}`}
              max={50}
              min={field === 'invoices' ? 1 : 0}
              onChange={(e) => setSize((current) => ({ ...current, [field]: Number(e.target.value) }))}
              type="number"
              value={size[field]}
            />
          </Field>
        ))}
        <Button disabled={!ready || busy !== null || run?.state === 'processing'} loading={busy === 'start'} loadingLabel={t('starting')} type="submit" variant="secondary">
          {t('start')}
        </Button>
        {run && run.state === 'processing' ? (
          <Button disabled={busy !== null} loading={busy === 'check'} loadingLabel={t('checking')} onClick={() => void act('check', () => checkTestSet(run.id))} variant="soft">
            {t('check')}
          </Button>
        ) : null}
      </form>
      <p className="mt-2 text-[13px] text-ink-3">{t('sizeHint')}</p>

      {errors ? (
        <div className="mt-4">
          <StepErrors errors={errors} />
        </div>
      ) : null}

      {run ? <RunResult run={run} /> : <p className="mt-5 text-[15px] text-ink-2">{t('noRun')}</p>}
    </Card>
  );
}

function RunResult({ run }: { run: TestSetRun }) {
  const t = useTranslations('testSet');
  const tKinds = useTranslations('console.kinds');
  const [showAll, setShowAll] = useState(false);
  const rules = groupRules(run.documents);

  return (
    <div className="mt-6 flex flex-col gap-4">
      {run.error ? <p className="rounded-lg bg-danger-bg px-4 py-3 text-[13px] text-danger-fg">{run.error}</p> : null}
      {run.phases
        .filter((phase) => phase.dian_status)
        .map((phase) => (
          <p className="text-[13px] text-ink-2" key={phase.name}>
            {t('dianSays', { phase: t(`phases.${phase.name === 'notes' ? 'notes' : 'invoices'}`), status: phase.dian_status })}
          </p>
        ))}

      {rules.length ? (
        <div>
          <h3 className="text-label mb-2">{t('rulesTitle')}</h3>
          <ul className="flex flex-col gap-2">
            {rules.map((rule) => (
              <li className={rule.rejection ? 'rounded-lg bg-danger-bg px-4 py-2.5 text-danger-fg' : 'rounded-lg bg-neutral-bg px-4 py-2.5 text-neutral-fg'} key={rule.key}>
                <span className="font-mono text-[13px] font-semibold">{rule.rule}</span>
                <span className="text-[13px]">: {rule.message}</span>
                <span className="ml-2 text-[12px] font-semibold opacity-80">{t('ruleCount', { count: rule.count })}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <Button aria-expanded={showAll} onClick={() => setShowAll((current) => !current)} size="sm" variant="ghost">
          {showAll ? t('hideDocuments') : t('showDocuments', { count: run.documents.length })}
        </Button>
        {showAll ? (
          <DataTable<TestSetDocument>
            caption={t('tableCaption')}
            className="mt-3"
            columns={[
              { key: 'document', header: t('columns.document'), mobile: 'title', cell: (document) => <span className="font-mono text-[13px]">{document.full_number}</span> },
              { key: 'kind', header: t('columns.kind'), mobile: 'body', cell: (document) => tKinds(document.kind) },
              {
                key: 'status',
                header: t('columns.status'),
                mobile: 'badge',
                cell: (document) => (
                  <Badge size="sm" tone={DOC_TONE[document.status]}>
                    {t(`docStatus.${document.status}`)}
                  </Badge>
                ),
              },
              {
                key: 'messages',
                header: t('columns.messages'),
                className: 'text-[13px] text-ink-2',
                cell: (document) => document.messages.map((message) => `${message.rule}: ${message.message}`).join(' · ') || '—',
              },
            ]}
            framed={false}
            rowKey={(document) => document.code}
            rows={run.documents}
          />
        ) : null}
      </div>
    </div>
  );
}

/** The DIAN's messages by rule, with how many documents carry each; rejections first. */
function groupRules(documents: TestSetDocument[]) {
  const byRule = new Map<string, { key: string; rule: string; message: string; rejection: boolean; count: number }>();
  for (const document of documents) {
    for (const message of document.messages) {
      const key = `${message.rule}|${message.message}`;
      const current = byRule.get(key);
      if (current) current.count += 1;
      else byRule.set(key, { key, rule: message.rule, message: message.message, rejection: message.severity !== 'notificacion', count: 1 });
    }
  }
  return [...byRule.values()].sort((a, b) => Number(b.rejection) - Number(a.rejection) || b.count - a.count);
}

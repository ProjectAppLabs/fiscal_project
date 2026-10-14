'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  fetchProduction,
  runProductionAction,
  stepErrors,
  type ProductionAction,
  type ProductionStatus,
} from '@/lib/services/onboarding';

const CARD_CLASS = 'rounded-2xl border border-border bg-card p-6';
const BUTTON_CLASS =
  'rounded-full border border-border px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const READINESS_KEYS = ['test_set_accepted', 'certificate', 'software', 'range', 'gateway'] as const;

export function ProductionPanel({ issuerId }: { issuerId: number }) {
  const t = useTranslations('production');
  const [status, setStatus] = useState<ProductionStatus | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<ProductionAction | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchProduction(issuerId)
      .then((data) => {
        if (active) setStatus(data ?? null);
      })
      .catch((error: unknown) => {
        if (active) setErrors(stepErrors(error));
      });
    return () => {
      active = false;
    };
  }, [issuerId]);

  const act = async (action: ProductionAction) => {
    setBusy(action);
    setErrors(null);
    try {
      setStatus(await runProductionAction(issuerId, action));
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setBusy(null);
    }
  };

  if (!status?.readiness) return null;
  const inProduction = status.environment === '1';
  const ready = READINESS_KEYS.every((key) => status.readiness[key]);

  return (
    <section aria-labelledby="issuer-production" className={CARD_CLASS}>
      <h2 className="text-lg font-semibold" id="issuer-production">
        {t('title')}
      </h2>
      {inProduction ? (
        <p className="mt-3 text-sm font-semibold text-success">{t('done')}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{t('body')}</p>
          <ul className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
            {READINESS_KEYS.map((key) => (
              <li className={status.readiness[key] ? 'text-success' : 'text-destructive'} key={key}>
                {status.readiness[key] ? '✓' : '✗'} {t(`readiness.${key}`)}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className={BUTTON_CLASS} disabled={busy !== null} onClick={() => void act('copy-software')} type="button">
              {t('copySoftware')}
            </button>
            <button className={BUTTON_CLASS} disabled={busy !== null || !status.readiness.software} onClick={() => void act('fetch-ranges')} type="button">
              {t('fetchRanges')}
            </button>
          </div>
          <label className="mt-6 flex items-start gap-2 text-sm">
            <input checked={confirmed} className="mt-1" onChange={(e) => setConfirmed(e.target.checked)} type="checkbox" />
            {t('confirm')}
          </label>
          <button
            className="mt-3 rounded-full bg-destructive px-5 py-2 text-sm text-white hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            disabled={!ready || !confirmed || busy !== null}
            onClick={() => void act('promote')}
            type="button"
          >
            {t('promote')}
          </button>
        </>
      )}
      {errors ? (
        <div className="mt-3 text-sm text-destructive" role="alert">
          <ul className="list-disc pl-5">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

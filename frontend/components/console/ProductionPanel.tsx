'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Choice } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { RequirementList } from '@/components/ui/Steps';
import { toast } from '@/components/ui/Toast';
import { useIsAdmin } from '@/lib/hooks/useIsAdmin';
import { fetchProduction, runProductionAction, stepErrors, type ProductionAction, type ProductionStatus } from '@/lib/services/onboarding';
import { StepErrors } from './ClientSystemForm';
import { HelpTip } from './HelpTip';

const READINESS_KEYS = ['test_set_accepted', 'certificate', 'software', 'range', 'gateway'] as const;

/**
 * The move to production (H-18), guided: what happens outside Fiscal. (marking «Habilitado» in the DIAN portal and
 * asking for the numbering in MUISCA), then each requirement with its own action, the confirmation and the switch.
 */
export function ProductionPanel({ issuerId, onChange }: { issuerId: number; onChange?: () => void }) {
  const t = useTranslations('production');
  const isAdmin = useIsAdmin();
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
      toast(t(`actionDone.${action}`));
      onChange?.();
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setBusy(null);
    }
  };

  if (!status?.readiness) return errors ? <StepErrors errors={errors} /> : null;
  const inProduction = status.environment === '1';
  const ready = READINESS_KEYS.every((key) => status.readiness[key]);
  const readyCount = READINESS_KEYS.filter((key) => status.readiness[key]).length;

  return (
    <Card aria-labelledby="issuer-production">
      <CardHeader
        help={<HelpTip label={t('title')} topic="production.habilitado" />}
        id="issuer-production"
        subtitle={inProduction ? undefined : t('readyCount', { ready: readyCount, total: READINESS_KEYS.length })}
        title={t('title')}
      />
      {inProduction ? (
        <Notice tone="success">{t('inProduction')}</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          <Notice title={t('outsideTitle')} tone="info">
            {t('outsideBody')} <HelpTip className="ml-0.5" label={t('outsideTitle')} topic="production.numbering" />
          </Notice>
          <RequirementList
            items={READINESS_KEYS.map((key) => ({
              key,
              ok: status.readiness[key],
              label: t(`readiness.${key}`),
              detail: status.readiness[key] ? undefined : t(`hints.${key}`),
              action:
                key === 'software' && !status.readiness.software ? (
                  <Button loading={busy === 'copy-software'} onClick={() => void act('copy-software')} size="sm" variant="soft">
                    {t('copySoftware')}
                  </Button>
                ) : key === 'range' && !status.readiness.range ? (
                  <Button disabled={busy !== null || !status.readiness.software} loading={busy === 'fetch-ranges'} onClick={() => void act('fetch-ranges')} size="sm" variant="soft">
                    {t('fetchRanges')}
                  </Button>
                ) : undefined,
            }))}
          />
          {isAdmin ? (
            <Choice
              checked={confirmed}
              className="rounded-lg bg-surface-sunk/70 px-4 py-3"
              description={t('confirmHint')}
              label={t('confirm')}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
          ) : null}
          {errors ? <StepErrors errors={errors} /> : null}
          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={!ready || !confirmed || busy !== null} loading={busy === 'promote'} onClick={() => void act('promote')} variant="danger">
                {t('promote')}
              </Button>
              {ready ? null : <span className="text-[13px] text-ink-3">{t('promoteHint')}</span>}
            </div>
          ) : (
            <Notice tone="neutral">{t('adminOnly')}</Notice>
          )}
        </div>
      )}
    </Card>
  );
}

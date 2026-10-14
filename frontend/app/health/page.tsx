'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCard } from '@/components/ui/States';
import { ROUTES } from '@/lib/constants';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { fetchHealth, type HealthDetail } from '@/lib/services/support';
import { cn } from '@/lib/cn';

// The page asks again on its own every 30 seconds, like the dashboard.
const REFRESH_MS = 30_000;
const WAITING_STATES = ['queued', 'transmitting', 'contingency_dian', 'contingency_issuer'] as const;
const STATUS_TONE = { ok: 'success', degraded: 'warning', down: 'danger' } as const;

/**
 * The service health in detail (H-36): each part with its state and what waits, so an operator knows where to look
 * without opening the server.
 */
export default function HealthPage() {
  const t = useTranslations('health');
  const locale = useLocale();
  const { isAuthenticated } = useRequireAuth();
  const [health, setHealth] = useState<HealthDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    () =>
      fetchHealth()
        .then((data) => {
          setHealth(data);
          setFailed(false);
        })
        .catch(() => setFailed(true)),
    [],
  );
  const reload = async () => {
    setLoading(true);
    await load();
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, load]);

  if (!isAuthenticated) return null;

  const refresh = (
    <Button icon={<RefreshCw aria-hidden className="size-4" />} loading={loading} onClick={() => void reload()} variant="secondary">
      {t('refresh')}
    </Button>
  );
  return (
    <Page>
      <PageHeader actions={refresh} emoji="health" subtitle={t('subtitle')} title={t('title')} />
      {failed && !health ? <ConsoleLoadError message={t('error')} onRetry={() => void reload()} /> : null}
      {!failed && !health ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}
      {health ? (
        <div className="flex flex-col gap-4">
          <Notice title={t(`status.${health.status}`)} tone={STATUS_TONE[health.status]}>
            {t(`statusBody.${health.status}`)} {t('checkedAt', { when: formatDateTime(health.checked_at, locale) })}
          </Notice>
          <div className="grid gap-4 md:grid-cols-2">
            <Card aria-labelledby="health-parts">
              <CardHeader id="health-parts" subtitle={t('partsSubtitle')} title={t('partsTitle')} />
              <ul className="flex flex-col gap-2">
                <Part label={t('database')} ok={health.database === 'ok'} value={health.database === 'ok' ? t('databaseOk') : t('databaseDown')} />
                <Part
                  detail={health.worker.last_beat_at ? t('lastBeat', { when: formatRelative(health.worker.last_beat_at, locale) }) : t('noBeat')}
                  hint={health.worker.ok ? undefined : t('workerHint')}
                  label={t('worker')}
                  ok={health.worker.ok}
                  value={health.worker.ok ? t('workerOk') : t('workerSilent')}
                />
                <Part
                  detail={health.queue.due ? t('oldestDue', { minutes: formatNumber(Math.round(health.queue.oldest_due_seconds / 60), locale) }) : undefined}
                  hint={health.queue.ok ? undefined : t('queueHint')}
                  label={t('queue')}
                  ok={health.queue.ok}
                  value={t('queueDue', { count: health.queue.due })}
                />
                <Part
                  detail={health.dian.last_answer_at ? t('lastAnswer', { when: formatRelative(health.dian.last_answer_at, locale) }) : t('noAnswer')}
                  label={t('dian')}
                  ok={!health.dian.in_contingency}
                  value={t('dianContingency', { count: health.dian.in_contingency })}
                />
              </ul>
            </Card>
            <Card aria-labelledby="health-waiting">
              <CardHeader id="health-waiting" subtitle={t('waitingSubtitle')} title={t('waitingTitle')} />
              <ul className="flex flex-col gap-2">
                {WAITING_STATES.map((state) => (
                  <Waiting count={health.documents[state]} href={`${ROUTES.DOCUMENTS}?state=${state}`} key={state} label={t(`documents.${state}`)} />
                ))}
                <Waiting count={health.notices.pending} href={ROUTES.CLIENT_SYSTEMS} label={t('noticesPending')} />
                <Waiting count={health.notices.failed} danger href={ROUTES.CLIENT_SYSTEMS} label={t('noticesFailed')} />
              </ul>
            </Card>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

function Part({ label, value, detail, hint, ok }: { label: string; value: string; detail?: string; hint?: string; ok: boolean }) {
  return (
    <li className="rounded-lg bg-surface-sunk/60 px-4 py-2.5">
      <span className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-medium text-ink">{label}</span>
        <span className="text-right">
          <span className={cn('block text-[13px] font-bold', ok ? 'text-success-fg' : 'text-danger-fg')}>{value}</span>
          {detail ? <span className="block text-[12px] text-ink-3">{detail}</span> : null}
        </span>
      </span>
      {hint ? <span className="mt-1.5 block text-[13px] text-ink-2">{hint}</span> : null}
    </li>
  );
}

function Waiting({ label, count, href, danger = false }: { label: string; count: number; href: string; danger?: boolean }) {
  return (
    <li>
      <Link className="flex items-center justify-between gap-3 rounded-lg bg-surface-sunk/60 px-4 py-2.5 hover:bg-surface-sunk" href={href}>
        <span className="text-[15px] font-medium text-ink">{label}</span>
        <Badge size="sm" tone={count ? (danger ? 'danger' : 'pending') : 'neutral'}>
          <span className="tabular-nums">{count}</span>
        </Badge>
      </Link>
    </li>
  );
}

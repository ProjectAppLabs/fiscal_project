'use client';

import { useLocale, useTranslations } from 'next-intl';

import { resolveLocale } from '@/lib/i18n/config';
import type { StagingBannerState } from '@/lib/services/staging-banner';

const PHASE_ICONS: Record<StagingBannerState['current_phase'], string> = {
  design: '🎨',
  development: '🛠️',
};

type Props = {
  state: StagingBannerState;
};

export default function StagingPhaseBanner({ state }: Props) {
  const t = useTranslations('staging');
  const locale = resolveLocale(useLocale());
  const days = state.days_remaining ?? 0;
  const isUrgent = days <= 2;
  const phaseLabel = state.phase_labels[locale];
  const verb = days === 1 ? t('remainsOne') : t('remainsMany');
  const noun = days === 1 ? t('dayOne') : t('dayMany');

  return (
    <div
      role="status"
      data-testid="staging-phase-banner"
      className={
        'sticky top-0 z-50 w-full border-b text-sm font-medium ' +
        (isUrgent
          ? 'bg-warning text-warning-foreground border-warning/40'
          : 'bg-info text-info-foreground border-info/40')
      }
    >
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-center">
        <span aria-hidden>{PHASE_ICONS[state.current_phase]}</span>
        <span>
          <strong>{phaseLabel}</strong> — {verb} <strong>{days} {noun}</strong> {t('forReview')}
        </span>
      </div>
    </div>
  );
}

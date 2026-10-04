'use client';

import { useLocale, useTranslations } from 'next-intl';

import { resolveLocale } from '@/lib/i18n/config';
import type { StagingBannerState } from '@/lib/services/staging-banner';

function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}`;
}

type Props = {
  state: StagingBannerState;
};

export default function StagingExpiredOverlay({ state }: Props) {
  const t = useTranslations('staging');
  const locale = resolveLocale(useLocale());
  const title = t('expiredTitle', { phase: state.phase_labels[locale].toLowerCase() });

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="staging-expired-overlay"
      className="fixed inset-0 z-[100] bg-background text-foreground overflow-auto"
    >
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full text-center space-y-6">
          <div className="text-5xl" aria-hidden>⏳</div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-lg text-muted-foreground">{t('expiredBody')}</p>
          <p className="text-base text-muted-foreground">{t('expiredCta')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <a
              href={whatsappLink(state.contact_whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="staging-expired-whatsapp"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-success text-success-foreground font-semibold hover:bg-success/90 transition-colors"
            >
              <span aria-hidden>📱</span>
              <span>{t('whatsapp')}: {state.contact_whatsapp}</span>
            </a>
            <a
              href={`mailto:${state.contact_email}`}
              data-testid="staging-expired-email"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-info text-info-foreground font-semibold hover:bg-info/90 transition-colors"
            >
              <span aria-hidden>✉️</span>
              <span>{t('email')}: {state.contact_email}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

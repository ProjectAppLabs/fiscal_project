'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { LOCALE_LABELS, resolveLocale, type SupportedLocale } from '@/lib/i18n/config';
import { useLocaleStore } from '@/lib/stores/localeStore';

const NEXT_LOCALE: Record<SupportedLocale, SupportedLocale> = {
  es: 'en',
  en: 'es',
};

export function LocaleSwitcher() {
  const t = useTranslations('locale');
  const router = useRouter();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const target = NEXT_LOCALE[resolveLocale(useLocale())];

  function handleClick() {
    setLocale(target);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('switchTo', { language: LOCALE_LABELS[target] })}
      className="inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-semibold uppercase text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {target}
    </button>
  );
}

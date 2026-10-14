'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { FiscalLogo } from '@/components/brand/FiscalLogo';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { EmojiTile, type EmojiName } from '@/components/ui/Emoji';

/** Sign in and password recovery: the Dawn aurora full screen and a soft-glass card in the middle. */
export function AuthScreen({ emoji, title, subtitle, children }: AuthScreenProps) {
  const t = useTranslations('footer');

  return (
    <main className="aurora-dawn relative flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-surface/60 p-1 backdrop-blur">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <EmojiTile className="relative z-10 -mb-8 shadow-float" name={emoji} size="xl" tone="surface" />
      <div className="glass w-full max-w-[440px] rounded-panel px-6 pb-8 pt-12 sm:px-8">
        <div className="text-center">
          <FiscalLogo className="text-[34px]" />
          <h1 className="mt-3 text-[22px] font-bold leading-7 tracking-[-0.01em] text-ink">{title}</h1>
          {subtitle ? <div className="mt-1.5 text-[15px] text-ink-2">{subtitle}</div> : null}
        </div>
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-6 text-center text-[13px] text-ink-2">&copy; 2026 Fiscal. {t('tagline')}</p>
    </main>
  );
}

interface AuthScreenProps {
  emoji: EmojiName;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

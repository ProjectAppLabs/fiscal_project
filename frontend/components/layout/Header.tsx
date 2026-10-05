'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { FiscalLogo } from '@/components/brand/FiscalLogo';
import { ThemeToggle } from '@/components/theme-toggle';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/lib/stores/authStore';
import { LocaleSwitcher } from './LocaleSwitcher';

const NAV_LINK_CLASS =
  'rounded px-2 py-1 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function Header() {
  const t = useTranslations('header');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link className="text-xl" href={ROUTES.HOME}>
          <FiscalLogo />
        </Link>

        <nav className="flex items-center gap-2 text-sm sm:gap-4" aria-label={t('mainNav')}>
          {isAuthenticated ? (
            <>
              <Link className={NAV_LINK_CLASS} href={ROUTES.DASHBOARD}>
                {t('dashboard')}
              </Link>
              <Link className={NAV_LINK_CLASS} href={ROUTES.DOCUMENTS}>
                {t('documents')}
              </Link>
            </>
          ) : null}

          <LocaleSwitcher />
          <ThemeToggle />

          {isAuthenticated ? (
            <button
              className="rounded-full border border-border px-4 py-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={signOut}
              type="button"
            >
              {t('signOut')}
            </button>
          ) : (
            <Link
              className="rounded-full bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={ROUTES.SIGN_IN}
            >
              {t('signIn')}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

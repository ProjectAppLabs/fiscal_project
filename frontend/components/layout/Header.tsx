'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { FiscalLogo } from '@/components/brand/FiscalLogo';
import { ThemeToggle } from '@/components/theme-toggle';
import { ROUTES } from '@/lib/constants';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { useAuthStore } from '@/lib/stores/authStore';
import { LocaleSwitcher } from './LocaleSwitcher';

const NAV_LINK_CLASS =
  'rounded px-2 py-1 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function Header() {
  const t = useTranslations('header');
  const hydrated = useHydrated();
  // The session comes from cookies the server render cannot read: show it once hydrated.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated) && hydrated;
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
      {/* One nav for every width: below lg it drops to its own row (order-3, full width) and scrolls sideways. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
        <Link className="order-1 text-xl" href={ROUTES.HOME}>
          <FiscalLogo />
        </Link>

        {isAuthenticated ? (
          <SessionLinks className="order-3 -mx-2 w-full overflow-x-auto lg:order-2 lg:mx-0 lg:w-auto" label={t('mainNav')} />
        ) : null}

        <div className="order-2 flex items-center gap-2 text-sm sm:gap-4 lg:order-3">
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
        </div>
      </div>

    </header>
  );
}

function SessionLinks({ className, label }: { className: string; label: string }) {
  const t = useTranslations('header');

  return (
    <nav aria-label={label} className={`flex items-center gap-1 text-sm whitespace-nowrap ${className}`}>
      {SESSION_LINKS.map(({ href, key }) => (
        <Link className={NAV_LINK_CLASS} href={href} key={href}>
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}

const SESSION_LINKS = [
  { href: ROUTES.DASHBOARD, key: 'dashboard' },
  { href: ROUTES.DOCUMENTS, key: 'documents' },
  { href: ROUTES.ISSUERS, key: 'issuers' },
  { href: ROUTES.CONTINGENCIES, key: 'contingencies' },
  { href: ROUTES.ALERTS, key: 'alerts' },
  { href: ROUTES.CLIENT_SYSTEMS, key: 'clientSystems' },
] as const;

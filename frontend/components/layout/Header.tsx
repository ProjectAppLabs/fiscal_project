'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Bell, Building2, FilePlus2, LayoutDashboard, LifeBuoy, MoreHorizontal, Plug, Receipt, X, type LucideIcon } from 'lucide-react';

import { FiscalLogo } from '@/components/brand/FiscalLogo';
import { CountBubble } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useAuthStore } from '@/lib/stores/authStore';
import { useConsoleStore } from '@/lib/stores/consoleStore';
import { AccountMenu } from './AccountMenu';

/**
 * Floating soft-glass header (H-01): the active page as a raised pill, counters on Alertas and Contingencias,
 * «Inscribir emisor» and who is signed in. Below 1024 px the menu becomes a bottom bar with «Más».
 * The sign-in pages draw their own screen, so the header stays out of them.
 */
export default function Header() {
  const t = useTranslations('header');
  const pathname = usePathname() ?? '/';
  const hydrated = useHydrated();
  // The session comes from cookies the server render cannot read: show it once hydrated.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated) && hydrated;
  const narrow = useMediaQuery('(max-width: 1023px)');
  const counts = useMenuCounts(isAuthenticated);

  if (AUTH_SCREENS.includes(pathname)) return null;

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6 lg:pt-4">
      <div className="glass mx-auto flex h-16 max-w-[1296px] items-center justify-between gap-3 rounded-full pl-5 pr-2 sm:pl-6">
        <Link className="text-[22px] text-ink" href={ROUTES.HOME}>
          <FiscalLogo />
        </Link>

        {isAuthenticated && !narrow ? <MainNav counts={counts} label={t('mainNav')} pathname={pathname} /> : null}

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {narrow ? null : (
                <ButtonLink href={ROUTES.ONBOARDING} icon={<FilePlus2 aria-hidden className="size-4" />} size="sm" variant="primary">
                  {t('onboarding')}
                </ButtonLink>
              )}
              <AccountMenu compact={narrow} />
            </>
          ) : (
            <ButtonLink href={ROUTES.SIGN_IN} size="sm" variant="primary">
              {t('signIn')}
            </ButtonLink>
          )}
        </div>
      </div>
      {isAuthenticated && narrow ? <BottomNav counts={counts} label={t('mainNav')} pathname={pathname} /> : null}
    </header>
  );
}

function MainNav({ label, pathname, counts }: NavProps) {
  const t = useTranslations('header');

  return (
    <nav aria-label={label} className="flex items-center gap-0.5 rounded-full bg-surface-sunk/70 p-1 shadow-sunk">
      {NAV.map(({ href, key }) => {
        const active = isActive(pathname, href);
        const count = key === 'alerts' ? counts.alerts : key === 'contingencies' ? counts.contingencies : 0;
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            aria-describedby={count ? `nav-count-${key}` : undefined}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition duration-200 ease-soft xl:px-4',
              active ? 'bg-surface text-ink shadow-rest' : 'text-ink-2 hover:text-ink',
            )}
            href={href}
            key={href}
          >
            {t(key)}
            <NavCount count={count} id={`nav-count-${key}`} tone={key === 'alerts' && counts.critical ? 'danger' : 'warning'} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Below 1024 px: Tablero, Documentos, Emisores, Alertas and «Más» (Contingencias, Sistemas cliente, Inscribir). */
function BottomNav({ label, pathname, counts }: NavProps) {
  const t = useTranslations('header');
  // «Más» stays open only on the page where it was opened: navigating closes it.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const moreOpen = openedAt === pathname;
  const setMoreOpen = (open: boolean | ((current: boolean) => boolean)) =>
    setOpenedAt((typeof open === 'function' ? open(moreOpen) : open) ? pathname : null);

  return (
    <>
      {moreOpen ? (
        <div className="appear glass fixed inset-x-3 bottom-24 z-50 rounded-panel p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-label">{t('more')}</span>
            <button aria-label={t('closeMore')} className="grid size-9 place-items-center rounded-full hover:bg-surface-sunk" onClick={() => setMoreOpen(false)} type="button">
              <X aria-hidden className="size-4" />
            </button>
          </div>
          {MORE.map(({ href, key, Icon }) => (
            <Link className="flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold text-ink hover:bg-surface/80" href={href} key={href}>
              <Icon aria-hidden className="size-5 text-ink-3" />
              {t(key)}
              {key === 'contingencies' ? <NavCount count={counts.contingencies} id="more-count" tone="warning" /> : null}
            </Link>
          ))}
        </div>
      ) : null}
      <nav aria-label={label} className="glass fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-panel p-1.5">
        {BOTTOM.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn('relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold', active ? 'bg-surface text-ink shadow-rest' : 'text-ink-2')}
              href={href}
              key={href}
            >
              <Icon aria-hidden className="size-5" />
              {t(key)}
              {key === 'alerts' ? (
                <span className="absolute right-3 top-1.5">
                  <NavCount count={counts.alerts} id="bottom-count" tone={counts.critical ? 'danger' : 'warning'} />
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          aria-expanded={moreOpen}
          className={cn('flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold', moreOpen ? 'bg-surface text-ink shadow-rest' : 'text-ink-2')}
          onClick={() => setMoreOpen((current) => !current)}
          type="button"
        >
          <MoreHorizontal aria-hidden className="size-5" />
          {t('more')}
        </button>
      </nav>
    </>
  );
}

function NavCount({ count, id, tone }: { count: number; id: string; tone: 'danger' | 'warning' }) {
  const t = useTranslations('header');
  if (!count) return null;
  return (
    <>
      <span aria-hidden>
        <CountBubble count={count} tone={tone} />
      </span>
      <span hidden id={id}>
        {t('openCount', { count })}
      </span>
    </>
  );
}

/** Open alerts and invoices in contingency, from the console summary (loaded once per session). */
function useMenuCounts(enabled: boolean): Counts {
  const summary = useConsoleStore((s) => s.summary);
  const status = useConsoleStore((s) => s.summaryStatus);
  const loadSummary = useConsoleStore((s) => s.loadSummary);

  useEffect(() => {
    if (enabled && status === 'idle') void loadSummary();
  }, [enabled, status, loadSummary]);

  return {
    alerts: summary?.alerts.total ?? 0,
    critical: summary?.alerts.critical ?? 0,
    contingencies: summary?.health?.dian?.in_contingency ?? 0,
  };
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const AUTH_SCREENS: string[] = [ROUTES.SIGN_IN, ROUTES.FORGOT_PASSWORD];

const NAV = [
  { href: ROUTES.DASHBOARD, key: 'dashboard' },
  { href: ROUTES.DOCUMENTS, key: 'documents' },
  { href: ROUTES.ISSUERS, key: 'issuers' },
  { href: ROUTES.CONTINGENCIES, key: 'contingencies' },
  { href: ROUTES.ALERTS, key: 'alerts' },
  { href: ROUTES.CLIENT_SYSTEMS, key: 'clientSystems' },
] as const;

const BOTTOM: { href: string; key: 'dashboard' | 'documents' | 'issuers' | 'alerts'; Icon: LucideIcon }[] = [
  { href: ROUTES.DASHBOARD, key: 'dashboard', Icon: LayoutDashboard },
  { href: ROUTES.DOCUMENTS, key: 'documents', Icon: Receipt },
  { href: ROUTES.ISSUERS, key: 'issuers', Icon: Building2 },
  { href: ROUTES.ALERTS, key: 'alerts', Icon: Bell },
];

const MORE: { href: string; key: 'contingencies' | 'clientSystems' | 'onboarding'; Icon: LucideIcon }[] = [
  { href: ROUTES.CONTINGENCIES, key: 'contingencies', Icon: LifeBuoy },
  { href: ROUTES.CLIENT_SYSTEMS, key: 'clientSystems', Icon: Plug },
  { href: ROUTES.ONBOARDING, key: 'onboarding', Icon: FilePlus2 },
];

interface Counts {
  alerts: number;
  critical: number;
  contingencies: number;
}

interface NavProps {
  label: string;
  pathname: string;
  counts: Counts;
}

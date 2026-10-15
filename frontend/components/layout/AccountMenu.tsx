'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, CircleHelp, KeyRound, LogOut, Monitor, Moon, Sun, Users } from 'lucide-react';

import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { LOCALE_LABELS, SUPPORTED_LOCALES, resolveLocale } from '@/lib/i18n/config';
import { useAuthStore } from '@/lib/stores/authStore';
import { useLocaleStore } from '@/lib/stores/localeStore';

/**
 * Who is signed in (H-02): initials and first name; the menu holds the name, e-mail and role, the language, the
 * theme, «Cambiar contraseña» and «Cerrar sesión».
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('header');
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '';
  const initials = initialsOf(user?.first_name, user?.last_name, user?.email);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('account')}
        className="flex h-11 items-center gap-2 rounded-full bg-surface/80 pl-1 pr-3 shadow-[0_0_0_1px_var(--line),inset_0_1px_0_#fff] transition hover:bg-surface dark:shadow-[0_0_0_1px_var(--line)]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-[13px] font-bold text-primary-text">{initials}</span>
        {compact ? null : <span className="max-w-28 truncate text-sm font-semibold text-ink">{user?.first_name || name}</span>}
        <ChevronDown aria-hidden className={cn('size-4 text-ink-3 transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="appear absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-lg bg-surface p-2 shadow-float" role="menu">
          <div className="px-3 pb-3 pt-2">
            <p className="truncate text-[15px] font-bold text-ink">{name}</p>
            <p className="truncate text-[13px] text-ink-3">
              {user?.email}
              {user?.role ? ` · ${t(`roles.${user.role === 'admin' ? 'admin' : 'operator'}`)}` : ''}
            </p>
          </div>
          <LanguageRow />
          <ThemeRow />
          {user?.role === 'admin' ? (
            <Link
              className="mt-1 flex h-11 items-center gap-3 rounded-sm px-3 text-sm font-semibold text-ink hover:bg-surface-sunk"
              href={ROUTES.USERS}
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <Users aria-hidden className="size-4 text-ink-3" />
              {t('users')}
            </Link>
          ) : null}
          <Link
            className="mt-1 flex h-11 items-center gap-3 rounded-sm px-3 text-sm font-semibold text-ink hover:bg-surface-sunk"
            href={ROUTES.API_DOCS}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <BookOpen aria-hidden className="size-4 text-ink-3" />
            {t('apiDocs')}
          </Link>
          <Link
            className="mt-1 flex h-11 items-center gap-3 rounded-sm px-3 text-sm font-semibold text-ink hover:bg-surface-sunk"
            href={ROUTES.HELP}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <CircleHelp aria-hidden className="size-4 text-ink-3" />
            {t('help')}
          </Link>
          <Link
            className="mt-1 flex h-11 items-center gap-3 rounded-sm px-3 text-sm font-semibold text-ink hover:bg-surface-sunk"
            href={ROUTES.ACCOUNT}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <KeyRound aria-hidden className="size-4 text-ink-3" />
            {t('changePassword')}
          </Link>
          <button
            className="mt-1 flex h-11 w-full items-center gap-3 rounded-sm bg-danger-bg/60 px-3 text-sm font-semibold text-danger-fg hover:bg-danger-bg"
            onClick={signOut}
            role="menuitem"
            type="button"
          >
            <LogOut aria-hidden className="size-4" />
            {t('signOut')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LanguageRow() {
  const t = useTranslations('header');
  const router = useRouter();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const current = resolveLocale(useLocale());

  return (
    <div className="flex items-center justify-between rounded-sm px-3 py-2">
      <span className="text-sm font-semibold text-ink">{t('language')}</span>
      <div className="flex rounded-full bg-surface-sunk p-0.5 shadow-sunk">
        {SUPPORTED_LOCALES.map((locale) => (
          <button
            aria-label={LOCALE_LABELS[locale]}
            aria-pressed={locale === current}
            className={cn('h-8 rounded-full px-3 text-xs font-bold uppercase', locale === current ? 'bg-surface text-ink shadow-rest' : 'text-ink-3')}
            key={locale}
            onClick={() => {
              setLocale(locale);
              router.refresh();
            }}
            type="button"
          >
            {locale}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeRow() {
  const t = useTranslations('theme');
  const tHeader = useTranslations('header');
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between rounded-sm px-3 py-2">
      <span className="text-sm font-semibold text-ink">{tHeader('theme')}</span>
      <div className="flex rounded-full bg-surface-sunk p-0.5 shadow-sunk">
        {THEMES.map(({ value, Icon }) => (
          <button
            aria-label={t(value)}
            aria-pressed={theme === value}
            className={cn('grid size-8 place-items-center rounded-full', theme === value ? 'bg-surface text-ink shadow-rest' : 'text-ink-3')}
            key={value}
            onClick={() => setTheme(value)}
            type="button"
          >
            <Icon aria-hidden className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

function initialsOf(first?: string, last?: string, email?: string): string {
  const letters = `${first?.[0] ?? ''}${last?.[0] ?? ''}`.trim();
  return (letters || email?.[0] || '·').toUpperCase();
}

const THEMES = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'system', Icon: Monitor },
] as const;

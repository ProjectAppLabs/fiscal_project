'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { BRAND_NAME } from '@/components/brand/FiscalLogo';

export default function Footer() {
  const t = useTranslations('footer');
  const pathname = usePathname() ?? '/';
  const authScreen = pathname === '/sign-in' || pathname === '/forgot-password';

  return (
    <footer className={authScreen ? 'sr-only' : 'pb-28 pt-10 lg:pb-10'}>
      <p className="mx-auto max-w-[1296px] px-6 text-center text-[13px] text-ink-3">
        &copy; 2026 {BRAND_NAME} {t('tagline')}
      </p>
    </footer>
  );
}

import { useTranslations } from 'next-intl';

import { BRAND_NAME } from '@/components/brand/FiscalLogo';

export default function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">
        &copy; 2026 {BRAND_NAME} {t('tagline')}
      </div>
    </footer>
  );
}

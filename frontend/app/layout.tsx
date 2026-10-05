import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';

import './globals.css';
import { BRAND_NAME } from '@/components/brand/FiscalLogo';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import StagingGate from '@/components/staging/StagingGate';
import Providers from './providers';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');

  return {
    title: BRAND_NAME,
    description: t('description'),
    applicationName: BRAND_NAME,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider>
          <Providers>
            <StagingGate>
              <Header />
              {children}
              <Footer />
            </StagingGate>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

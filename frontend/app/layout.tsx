import type { Metadata } from 'next';
import { Figtree, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';

import './globals.css';
import { BRAND_NAME } from '@/components/brand/FiscalLogo';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import StagingGate from '@/components/staging/StagingGate';
import { Toaster } from '@/components/ui/Toast';
import Providers from './providers';

// Algodón: Figtree for the whole interface, JetBrains Mono for NIT, numbers, CUFE, keys and JSON.
const figtree = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-figtree', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-jetbrains', display: 'swap' });

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
    <html className={`${figtree.variable} ${jetbrains.variable}`} lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh">
        {/* The Glacier aurora: a band behind the header and each page title, never behind tables. */}
        <div aria-hidden className="aurora-glacier pointer-events-none absolute inset-x-0 top-0 -z-10 h-80" />
        <NextIntlClientProvider>
          <Providers>
            <StagingGate>
              <Header />
              {children}
              <Footer />
              <Toaster />
            </StagingGate>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

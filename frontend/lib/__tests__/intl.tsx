import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import en from '../../messages/en.json';
import es from '../../messages/es.json';

const MESSAGES = { es, en } as const;

type TestLocale = keyof typeof MESSAGES;

export function renderWithIntl(
  ui: ReactElement,
  { locale = 'es', ...options }: RenderOptions & { locale?: TestLocale } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="America/Bogota">
        {children}
      </NextIntlClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

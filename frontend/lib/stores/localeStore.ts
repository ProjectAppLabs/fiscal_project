'use client';

import Cookies from 'js-cookie';
import { create } from 'zustand';

import { LOCALE_COOKIE, isValidLocale, resolveLocale, type SupportedLocale } from '@/lib/i18n/config';

type LocaleState = {
  locale: SupportedLocale;
  setLocale: (locale: string) => void;
};

const ONE_YEAR_IN_DAYS = 365;

// The cookie is the source of truth: next-intl reads it on the server for every request.
export const useLocaleStore = create<LocaleState>((set) => ({
  locale: resolveLocale(Cookies.get(LOCALE_COOKIE)),
  setLocale: (locale) => {
    if (!isValidLocale(locale)) return;
    Cookies.set(LOCALE_COOKIE, locale, { sameSite: 'lax', expires: ONE_YEAR_IN_DAYS });
    set({ locale });
  },
}));

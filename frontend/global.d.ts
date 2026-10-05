import type { SupportedLocale } from '@/lib/i18n/config';
import type messages from './messages/es.json';

// Typed message keys: a missing or misspelled key fails the typecheck.
declare module 'next-intl' {
  interface AppConfig {
    Locale: SupportedLocale;
    Messages: typeof messages;
  }
}

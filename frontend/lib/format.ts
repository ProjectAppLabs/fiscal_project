import { DISPLAY_TIME_ZONE } from '@/lib/constants';

const SHORT_HASH_LENGTH = 12;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Readable date and time in Colombia's time zone; empty values render as an em dash. */
export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

export function formatBytes(size: number, locale: string): string {
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: unitIndex === 0 ? 0 : 1 }).format(value);
  return `${formatted} ${BYTE_UNITS[unitIndex]}`;
}

export function shortHash(hash: string): string {
  return hash.length > SHORT_HASH_LENGTH ? `${hash.slice(0, SHORT_HASH_LENGTH)}…` : hash;
}

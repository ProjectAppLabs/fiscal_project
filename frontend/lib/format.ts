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

/**
 * Only the day, for what has no meaningful time (expiry, validity, resolutions). A plain `YYYY-MM-DD` is read as that
 * calendar day; a timestamp is read in Colombia's time zone, so midnight UTC does not slip to the previous day.
 */
export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';

  const plainDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(plainDay ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: plainDay ? 'UTC' : DISPLAY_TIME_ZONE,
  }).format(date);
}

/** «hace 5 min», «en 3 días»: a companion to the absolute date, never a replacement. */
export function formatRelative(value: string | null | undefined, locale: string, now: Date = new Date()): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size || unit === 'second') return format.format(Math.round(seconds / size), unit);
  }
  return '—';
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

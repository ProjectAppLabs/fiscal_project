import Image from 'next/image';

import { cn } from '@/lib/cn';

/**
 * Fluent Emoji 3D (Microsoft, MIT; public/emoji/LICENSE), exported at 128 px so they stay sharp up to 64 px.
 * Algodón uses them sparingly: page headers, empty states, the issuer's life cycle and celebrations. Never inside
 * tables, badges, DIAN messages or legal text.
 */
export function Emoji({ name, size = 24, label, className }: EmojiProps) {
  return (
    <Image
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block shrink-0 select-none', className)}
      draggable={false}
      height={size}
      src={`/emoji/${name}.webp`}
      width={size}
    />
  );
}

/** The emoji inside a soft square with its family's tint: highlight on top, sunk edge below. */
export function EmojiTile({ name, tone = 'primary', size = 'md', className }: EmojiTileProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center shadow-[inset_0_1px_0_rgb(255_255_255/0.85),inset_0_-2px_0_rgb(48_38_110/0.06)]',
        TILE_SIZE[size].box,
        TILE_TONE[tone],
        className,
      )}
    >
      <Emoji name={name} size={TILE_SIZE[size].emoji} />
    </span>
  );
}

const TILE_SIZE = {
  sm: { box: 'size-8 rounded-xs', emoji: 20 },
  md: { box: 'size-11 rounded-sm', emoji: 26 },
  lg: { box: 'size-14 rounded-lg', emoji: 34 },
  xl: { box: 'size-20 rounded-card', emoji: 52 },
} as const;

const TILE_TONE = {
  primary: 'bg-primary-soft',
  success: 'bg-success-bg',
  info: 'bg-info-bg',
  pending: 'bg-pending-bg',
  warning: 'bg-warning-bg',
  danger: 'bg-danger-bg',
  neutral: 'bg-neutral-bg',
  surface: 'bg-surface shadow-rest',
} as const;

export const EMOJI_NAMES = [
  'alerts', 'client-systems', 'contingencies', 'dashboard', 'documents', 'empty', 'enabled', 'enrol', 'enrolled',
  'health', 'issuers', 'mail', 'production', 'rejected', 'search', 'sign-in', 'success', 'test-set', 'user', 'warning',
] as const;

export type EmojiName = (typeof EMOJI_NAMES)[number];
export type Tone = keyof typeof TILE_TONE;

interface EmojiProps {
  name: EmojiName;
  size?: number;
  /** Only when the emoji goes without words. */
  label?: string;
  className?: string;
}

interface EmojiTileProps {
  name: EmojiName;
  tone?: Tone;
  size?: keyof typeof TILE_SIZE;
  className?: string;
}

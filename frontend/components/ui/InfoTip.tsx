'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';

import { cn } from '@/lib/cn';

const BUBBLE_WIDTH = 320;
const GUTTER = 16;
// Below the button unless it is near the bottom of the screen and there is more room above.
const ROOM_BELOW = 280;

/** Where the bubble goes for a button at `rect` on a screen of `width` × `height`. */
export function bubblePosition(rect: Pick<DOMRect, 'left' | 'top' | 'bottom'>, width: number, height: number): CSSProperties {
  const bubbleWidth = Math.min(BUBBLE_WIDTH, width - GUTTER * 2);
  const left = Math.min(Math.max(GUTTER, rect.left - 8), width - bubbleWidth - GUTTER);
  const above = height - rect.bottom < ROOM_BELOW && rect.top > height - rect.bottom;
  return above ? { bottom: height - rect.top + 6, left, width: bubbleWidth } : { top: rect.bottom + 6, left, width: bubbleWidth };
}

/**
 * A «?» next to a label that opens a short explanation (a toggletip). It opens on click or tap, so it works the same on
 * phones and with the keyboard; Escape, a click outside or the button again close it. The bubble sits under the button,
 * follows it on scroll and stays inside the screen, so it never makes the page scroll sideways on a phone. It lives in
 * <body> (a card with an animation would otherwise move it) and the button describes itself with it.
 */
export function InfoTip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const t = useTranslations('ui');
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const open = position !== null;

  const measure = () => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? bubblePosition(rect, document.documentElement.clientWidth, window.innerHeight) : null;
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const follow = () => setPosition((current) => (current ? measure() : current));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !bubble.current?.contains(target)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = () => {
    setPosition(open ? null : measure());
  };

  return (
    <span className={cn('relative inline-flex shrink-0 align-middle', className)} ref={ref}>
      <button
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        aria-label={t('helpAbout', { label })}
        className={cn(
          '-my-1 inline-flex size-6 items-center justify-center rounded-full transition',
          open ? 'bg-primary-soft text-primary-text' : 'text-ink-3 hover:bg-surface-sunk hover:text-primary-text',
          'focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(157_140_250/0.45)]',
        )}
        onClick={toggle}
        type="button"
      >
        <CircleHelp aria-hidden className="size-4" />
      </button>
      {position
        ? createPortal(
            <span
              className="appear fixed z-50 block rounded-lg bg-surface p-4 text-left text-[13px] font-normal normal-case leading-relaxed tracking-normal text-ink-2 shadow-float"
              id={id}
              ref={bubble}
              role="note"
              style={position}
            >
              {children}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * One pill that slides to the active item instead of each item painting its own background, so changing page never
 * blinks. Items carry `data-pill="<key>"`; the container must be positioned (relative, fixed…) because the pill is
 * placed with the items' offsets. The pill is moved straight in the DOM: it jumps into place on the first paint, on a
 * resize or when it reappears, and slides only when the active item changes. With no active item it fades out.
 */
export function useSlidingPill<Container extends HTMLElement>(activeKey: string | null) {
  const containerRef = useRef<Container>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    if (!container || !pill) return;

    const place = (instant: boolean) => {
      const target = activeKey ? container.querySelector<HTMLElement>(`[data-pill="${activeKey}"]`) : null;
      if (!target) {
        pill.style.opacity = '0';
        return;
      }
      const jump = instant || pill.style.opacity !== '1';
      if (jump) pill.style.transition = 'none';
      pill.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`;
      pill.style.width = `${target.offsetWidth}px`;
      pill.style.height = `${target.offsetHeight}px`;
      if (jump) {
        // Commit the jump before the transition comes back, so only the fade-in animates.
        void pill.offsetWidth;
        pill.style.transition = '';
      }
      pill.style.opacity = '1';
    };

    place(false);
    if (typeof ResizeObserver === 'undefined') return;
    // Counters that appear later, fonts that load and window resizes change the items' size: follow without sliding.
    // The observer reports every item once when it starts: that first report is skipped so the slide is not cut.
    let started = false;
    const observer = new ResizeObserver(() => {
      if (started) place(true);
      started = true;
    });
    observer.observe(container);
    container.querySelectorAll('[data-pill]').forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [activeKey]);

  return { containerRef, pillRef };
}

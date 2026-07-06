'use client';

import { useEffect, useRef, useState } from 'react';

export type RevealPhase = 'initial' | 'hidden' | 'play' | 'static';

/**
 * Drives scroll-triggered reveals without a pre-hydration flash.
 *
 * Server HTML renders fully visible (SEO-safe, no-JS-safe). After mount,
 * elements still below the fold are hidden and animate in when they
 * intersect. Elements already on screen at hydration stay visible
 * ('static') so nothing blinks, unless `eager` forces them to play.
 */
export function useRevealPhase<T extends Element>(opts?: {
  eager?: boolean;
  margin?: string;
  threshold?: number;
}) {
  const ref = useRef<T | null>(null);
  const [phase, setPhase] = useState<RevealPhase>('initial');
  const { eager = false, margin = '0px 0px -8% 0px', threshold = 0.12 } = opts ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const rect = el.getBoundingClientRect();
    const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
    if (onScreen && !eager) {
      setPhase('static');
      return;
    }

    setPhase('hidden');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setPhase('play');
            io.disconnect();
          }
        }
      },
      { rootMargin: margin, threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, margin, threshold]);

  return { ref, phase };
}

'use client';

import { useEffect } from 'react';

const MAX_TILT = 2.2; // degrees

/**
 * One delegated pointer listener that powers two card effects with no
 * wrapper elements:
 *  - `.card-glow`: a soft accent radial that follows the cursor (via --mx/--my)
 *  - `.card-tilt`: adds a subtle 3D tilt toward the cursor (via --rx/--ry)
 * Inert on touch devices; tilt disabled under reduced motion.
 */
export default function PointerEffects() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current: HTMLElement | null = null;

    const reset = (el: HTMLElement) => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    };

    const onMove = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const el = (target?.closest?.('.card-glow, .card-tilt') ?? null) as HTMLElement | null;
      if (current && current !== el) reset(current);
      current = el;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.setProperty('--mx', `${x.toFixed(0)}px`);
      el.style.setProperty('--my', `${y.toFixed(0)}px`);

      if (!reduced && el.classList.contains('card-tilt')) {
        const rx = (y / r.height - 0.5) * -2 * MAX_TILT;
        const ry = (x / r.width - 0.5) * 2 * MAX_TILT;
        el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
        el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      }
    };

    const onLeave = () => {
      if (current) reset(current);
      current = null;
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return null;
}

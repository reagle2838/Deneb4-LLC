'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface MagneticProps {
  children: ReactNode;
  /** Fraction of the cursor offset applied to the element. */
  strength?: number;
  /** Maximum translation in px. */
  max?: number;
  className?: string;
}

/**
 * Makes a CTA lean gently toward the cursor. Disabled on touch devices
 * and under reduced motion (renders children untouched).
 */
export default function Magnetic({
  children,
  strength = 0.22,
  max = 7,
  className,
}: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(fine && !reduced);
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!enabled || !el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const clamp = (v: number) => Math.max(-max, Math.min(max, v));
    el.style.transform = `translate(${clamp(dx * strength)}px, ${clamp(dy * strength)}px)`;
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = '';
  };

  return (
    <span
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={className}
      style={{
        display: 'inline-block',
        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'transform',
      }}
    >
      {children}
    </span>
  );
}

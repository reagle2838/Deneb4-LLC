'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRevealPhase } from './useReveal';
import { useReducedMotion } from './useReducedMotion';

interface CounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  /** Animation length in ms. */
  duration?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Animated number that counts up (ease-out) when it scrolls into view.
 * Server HTML shows the final value; reduced motion skips the count.
 */
export default function Counter({
  value,
  prefix = '',
  suffix = '',
  duration = 1400,
  className,
  style,
}: CounterProps) {
  const { ref, phase } = useRevealPhase<HTMLSpanElement>();
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (phase === 'hidden') {
      setDisplay(0);
      return;
    }
    if (phase !== 'play') return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, value, duration, reduced]);

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}
      {display.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}

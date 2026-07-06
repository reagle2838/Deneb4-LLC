'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

interface ParallaxProps {
  children?: ReactNode;
  /** Positive drifts up as you scroll down. Keep small (0.05 to 0.2). */
  speed?: number;
  /** Hard clamp on the drift, px. */
  clamp?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Gentle scroll-linked drift for decorative layers only (grids, marks).
 * Never put interactive content inside. Off under reduced motion.
 */
export default function Parallax({
  children,
  speed = 0.12,
  clamp = 70,
  className,
  style,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const offset = r.top + r.height / 2 - window.innerHeight / 2;
      const y = Math.max(-clamp, Math.min(clamp, -offset * speed));
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed, clamp]);

  return (
    <div ref={ref} className={className} style={{ ...style, willChange: 'transform' }}>
      {children}
    </div>
  );
}

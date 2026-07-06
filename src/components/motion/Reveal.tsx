'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useRevealPhase } from './useReveal';

type Variant = 'fade-up' | 'fade' | 'fade-left' | 'fade-right' | 'scale-in';

interface RevealProps {
  children: ReactNode;
  variant?: Variant;
  /** Extra animation delay in ms (stacks after the element intersects). */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: 'div' | 'section' | 'span' | 'li' | 'header' | 'figure';
  /** Play the entrance even if the element is on screen at hydration. */
  eager?: boolean;
}

/** Scroll-triggered entrance for a single block. */
export default function Reveal({
  children,
  variant = 'fade-up',
  delay = 0,
  className = '',
  style,
  as = 'div',
  eager = false,
}: RevealProps) {
  const Tag = as;
  const { ref, phase } = useRevealPhase<HTMLDivElement>({ eager });
  const cls =
    phase === 'hidden' ? 'reveal-hidden' : phase === 'play' ? 'reveal-play' : '';

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-variant={variant}
      className={cls ? `${cls} ${className}`.trim() : className}
      style={
        delay
          ? ({ ...style, '--reveal-delay': `${delay}ms` } as CSSProperties)
          : style
      }
    >
      {children}
    </Tag>
  );
}

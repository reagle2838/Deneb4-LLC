'use client';

import type { CSSProperties } from 'react';
import { useRevealPhase } from './useReveal';

type Variant = 'crosshair' | 'corner' | 'dim';

interface BlueprintDrawProps {
  variant?: Variant;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Extra delay in ms before the strokes start drawing. */
  delay?: number;
}

/**
 * Decorative technical-drawing marks that draw themselves in when they
 * scroll into view: a surveyor's crosshair, a drawing-border corner
 * bracket, or a dimension line. Purely ornamental (aria-hidden).
 */
export default function BlueprintDraw({
  variant = 'crosshair',
  size = 48,
  className,
  style,
  delay = 0,
}: BlueprintDrawProps) {
  const { ref, phase } = useRevealPhase<SVGSVGElement>({ eager: true });
  const cls = phase === 'hidden' ? 'bp-hidden' : phase === 'play' ? 'bp-play' : '';
  const common = {
    ref,
    'aria-hidden': true as const,
    className: cls ? `${cls} ${className ?? ''}`.trim() : className,
    style: {
      ...style,
      ...(delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : {}),
    },
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
  };

  if (variant === 'corner') {
    return (
      <svg {...common} width={size} height={size} viewBox="0 0 40 40">
        <path pathLength={1} d="M1 14 L1 1 L14 1" style={{ '--bp-i': 0 } as CSSProperties} />
        <path pathLength={1} d="M7 20 L7 7 L20 7" style={{ '--bp-i': 1 } as CSSProperties} opacity={0.45} />
        <circle className="bp-dot" cx="14" cy="14" r="1.6" fill="currentColor" stroke="none" style={{ '--bp-i': 2 } as CSSProperties} />
      </svg>
    );
  }

  if (variant === 'dim') {
    return (
      <svg {...common} width={size * 2.6} height={Math.round(size / 3)} viewBox="0 0 125 16">
        <line pathLength={1} x1="2" y1="2" x2="2" y2="14" style={{ '--bp-i': 0 } as CSSProperties} />
        <line pathLength={1} x1="123" y1="2" x2="123" y2="14" style={{ '--bp-i': 1 } as CSSProperties} />
        <line pathLength={1} x1="2" y1="8" x2="123" y2="8" style={{ '--bp-i': 2 } as CSSProperties} />
        <path pathLength={1} d="M9 5 L3 8 L9 11" style={{ '--bp-i': 3 } as CSSProperties} />
        <path pathLength={1} d="M116 5 L122 8 L116 11" style={{ '--bp-i': 4 } as CSSProperties} />
      </svg>
    );
  }

  return (
    <svg {...common} width={size} height={size} viewBox="0 0 48 48">
      <circle pathLength={1} cx="24" cy="24" r="14" style={{ '--bp-i': 0 } as CSSProperties} />
      <line pathLength={1} x1="24" y1="2" x2="24" y2="10" style={{ '--bp-i': 1 } as CSSProperties} />
      <line pathLength={1} x1="24" y1="38" x2="24" y2="46" style={{ '--bp-i': 2 } as CSSProperties} />
      <line pathLength={1} x1="2" y1="24" x2="10" y2="24" style={{ '--bp-i': 3 } as CSSProperties} />
      <line pathLength={1} x1="38" y1="24" x2="46" y2="24" style={{ '--bp-i': 4 } as CSSProperties} />
      <circle className="bp-dot" cx="24" cy="24" r="1.8" fill="currentColor" stroke="none" style={{ '--bp-i': 5 } as CSSProperties} />
    </svg>
  );
}

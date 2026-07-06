'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useRevealPhase } from './useReveal';

type Variant = 'fade-up' | 'fade' | 'scale-in';

interface StaggerProps {
  children: ReactNode;
  /** Delay between successive children, ms. */
  step?: number;
  /** Base delay before the first child, ms. */
  delay?: number;
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
  as?: 'div' | 'ul' | 'section';
}

/**
 * Staggered entrance for a group. Children are NOT wrapped: each direct
 * child gets a CSS index variable cloned onto it, so grid and flex
 * layouts are untouched.
 */
export default function Stagger({
  children,
  step = 90,
  delay = 0,
  variant = 'fade-up',
  className = '',
  style,
  as = 'div',
}: StaggerProps) {
  const Tag = as;
  const { ref, phase } = useRevealPhase<HTMLDivElement>();
  const cls =
    phase === 'hidden' ? 'stagger-hidden' : phase === 'play' ? 'stagger-play' : '';

  const items = Children.toArray(children).map((child, i) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ style?: CSSProperties }>;
    return cloneElement(el, {
      style: { ...el.props.style, '--si': i } as CSSProperties,
    });
  });

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-variant={variant}
      className={cls ? `${cls} ${className}`.trim() : className}
      style={
        {
          ...style,
          '--stagger-step': `${step}ms`,
          ...(delay ? { '--reveal-delay': `${delay}ms` } : {}),
        } as CSSProperties
      }
    >
      {items}
    </Tag>
  );
}

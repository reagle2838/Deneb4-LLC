'use client';

import { useRevealPhase } from './useReveal';

interface SectionRuleProps {
  className?: string;
  /** Optional mono spec label at the right end of the rule. */
  label?: string;
}

/** A hairline accent rule that draws itself across when scrolled to. */
export default function SectionRule({ className = '', label }: SectionRuleProps) {
  const { ref, phase } = useRevealPhase<HTMLDivElement>({ eager: true });
  const cls =
    phase === 'hidden' ? 'rule-hidden' : phase === 'play' ? 'rule-play' : '';

  return (
    <div ref={ref} className={`flex items-center gap-4 ${className}`.trim()} aria-hidden>
      <div className={`section-rule flex-1 ${cls}`.trim()} />
      {label && (
        <span
          className={`font-spec text-[10px] tracking-[0.25em] uppercase flex-shrink-0 ${
            phase === 'hidden' ? 'opacity-0' : ''
          }`}
          style={{
            color: 'var(--text-faint)',
            transition: 'opacity 0.6s ease 0.5s',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { PHASES } from '@/data/process';

export default function PhaseStack() {
  // `order` holds phase indices, front-most first.
  const [order, setOrder] = useState(() => PHASES.map((_, i) => i));
  const [flying, setFlying] = useState<number | null>(null);
  const frontPhase = order[0];
  const animating = flying !== null;

  // Lift the front card off the top, then drop it to the back.
  const next = () => {
    if (animating) return;
    const f = order[0];
    setFlying(f);
    window.setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setFlying(null);
    }, 400);
  };
  const prev = () => {
    if (animating) return;
    setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);
  };
  const goTo = (phaseIdx: number) => {
    if (animating) return;
    setOrder((o) => {
      const pos = o.indexOf(phaseIdx);
      return pos < 0 ? o : [...o.slice(pos), ...o.slice(0, pos)];
    });
  };

  return (
    <div>
      {/* Card deck */}
      <div className="relative mx-auto" style={{ maxWidth: '720px' }}>
        <div className="relative h-[480px] sm:h-[400px]">
          {order.map((phaseIdx, depth) => {
            const phase = PHASES[phaseIdx];
            const isFront = depth === 0;
            const isFlying = phaseIdx === flying;
            const transform = isFlying
              ? 'translate(-72px, -88px) scale(1.05) rotate(-5deg)'
              : `translate(${depth * 32}px, ${depth * 20}px) scale(${1 - depth * 0.02})`;
            return (
              <div
                key={phaseIdx}
                onClick={isFront ? next : undefined}
                aria-hidden={!isFront}
                className="card p-8 lg:p-10 flex flex-col overflow-hidden absolute inset-0"
                style={{
                  transform,
                  transformOrigin: 'top left',
                  zIndex: isFlying ? 999 : order.length - depth,
                  opacity: isFlying ? 1 : depth > 2 ? 0 : 1 - depth * 0.12,
                  boxShadow: isFlying ? '0 24px 50px rgba(0,0,0,0.22)' : undefined,
                  transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease, box-shadow 0.5s ease',
                  cursor: isFront && !animating ? 'pointer' : 'default',
                  pointerEvents: isFront && !animating ? 'auto' : 'none',
                  borderColor: isFront ? 'var(--accent)' : 'var(--border-accent)',
                  background: 'var(--bg-surface)',
                }}
              >
                <div className="flex items-baseline gap-4 mb-3">
                  <span className="font-spec text-4xl font-bold" style={{ color: 'var(--accent-light)' }}>{phase.n}</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{phase.title}</h2>
                </div>
                <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>{phase.summary}</p>
                <p className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-faint)' }}>Deliverables</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {phase.deliverables.map((d) => (
                    <div key={d} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--accent)' }} className="mt-1.5 text-[8px] flex-shrink-0">●</span>{d}
                    </div>
                  ))}
                </div>
                {isFront && (
                  <span className="mt-auto pt-4 font-spec text-[11px] tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
                    Click to advance →
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 mt-10">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous phase"
          className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
          style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-heading)' }}
        >
          ‹
        </button>

        <div className="flex items-center gap-2">
          {PHASES.map((p, i) => (
            <button
              key={p.n}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to ${p.title}`}
              aria-current={frontPhase === i ? 'true' : undefined}
              className="rounded-full transition-all"
              style={{
                width: frontPhase === i ? '24px' : '8px',
                height: '8px',
                background: frontPhase === i ? 'var(--accent)' : 'var(--border-accent)',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          aria-label="Next phase"
          className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
          style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-heading)' }}
        >
          ›
        </button>
      </div>

      <p className="text-center font-spec text-xs mt-4" style={{ color: 'var(--text-faint)' }}>
        Phase {frontPhase + 1} of {PHASES.length}
      </p>
    </div>
  );
}

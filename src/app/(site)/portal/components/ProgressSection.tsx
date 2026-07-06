import { BUILD_STAGES, PORTAL_STAGE_LABELS } from '@/lib/stages';

/** The 4-step progress bar with plain-language stage names. */
export default function ProgressSection({ stage }: { stage: string }) {
  const currentIndex = (BUILD_STAGES as readonly string[]).indexOf(stage);
  const pct = currentIndex < 0 ? 0 : Math.round((currentIndex / (BUILD_STAGES.length - 1)) * 100);

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Where your project stands</h2>
        <span
          className="font-spec text-xs tracking-widest uppercase"
          style={{ color: currentIndex < 0 ? 'var(--text-faint)' : 'var(--accent-light)' }}
        >
          {currentIndex < 0 ? 'Not started yet' : PORTAL_STAGE_LABELS[BUILD_STAGES[currentIndex]] ?? BUILD_STAGES[currentIndex]}
        </span>
      </div>
      <div className="flex items-start">
        {BUILD_STAGES.map((s, i) => {
          const done = i <= currentIndex;
          return (
            <div key={s} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <span
                  className="absolute h-0.5"
                  style={{ top: '7px', left: '-50%', width: '100%', background: i <= currentIndex ? 'var(--accent)' : 'var(--border-accent)' }}
                />
              )}
              <span
                className="relative z-10 rounded-full"
                style={{
                  width: '16px',
                  height: '16px',
                  background: done ? 'var(--accent)' : 'var(--bg-surface)',
                  border: `2px solid ${done ? 'var(--accent)' : 'var(--border-accent)'}`,
                }}
              />
              <span
                className="mt-2 text-center text-xs px-1"
                style={{ color: done ? 'var(--text-heading)' : 'var(--text-faint)', fontWeight: i === currentIndex ? 600 : 400 }}
              >
                {PORTAL_STAGE_LABELS[s] ?? s}
              </span>
            </div>
          );
        })}
      </div>
      <p className="font-spec text-[11px] tracking-widest mt-4" style={{ color: 'var(--text-faint)' }}>{pct}% COMPLETE</p>
    </div>
  );
}

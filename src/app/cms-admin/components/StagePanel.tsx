'use client';

import { BUILD_STAGES } from '@/lib/stages';
import type { ClientDraft } from './useClientDraft';
import { Select } from './fields';

/** Stage control + a mini preview of the progress bar the client sees. */
export default function StagePanel({ d }: { d: ClientDraft }) {
  const currentIndex = (BUILD_STAGES as readonly string[]).indexOf(d.draft.stage);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Build stage
        </h3>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={d.draft.active}
            onChange={(e) => d.patch({ active: e.target.checked })}
          />
          Active (can log in)
        </label>
      </div>
      <Select
        value={d.draft.stage}
        onChange={(v) => d.patch({ stage: v })}
        options={[['', 'Not started'], ...BUILD_STAGES.map((s) => [s, s] as [string, string])]}
      />
      <div className="flex items-center gap-1 mt-3" aria-hidden>
        {BUILD_STAGES.map((s, i) => (
          <span
            key={s}
            className="h-1 flex-1 rounded-full"
            style={{ background: i <= currentIndex ? 'var(--accent)' : 'var(--bg-raised)' }}
          />
        ))}
      </div>
      <p className="text-[11px] mt-2 font-spec" style={{ color: 'var(--text-faint)' }}>
        Drives the progress bar in the client portal.
      </p>
    </div>
  );
}

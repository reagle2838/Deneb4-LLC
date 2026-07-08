'use client';

import { useState } from 'react';
import { PIPELINE_STAGES, getPipelineStage, pipelineIndex } from '@/lib/pipeline';
import { agentLabel } from '@/lib/agent-roster';
import { Select } from './fields';

/**
 * The client's internal pipeline stage: where the project stands and
 * which agent owns the current step. Changes go through
 * /api/agents/pipeline so every transition lands on the client's
 * ledger channel.
 */
export default function PipelinePanel({
  slug,
  initialStage,
  onChanged,
}: {
  slug: string;
  initialStage: string;
  onChanged?: (stage: string) => void;
}) {
  const [stage, setStage] = useState(initialStage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const current = getPipelineStage(stage);
  const idx = pipelineIndex(stage);

  async function change(next: string) {
    if (!next || next === stage) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/agents/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: slug, stage: next, agent: 'ridhi' }),
      });
      const data = (await res.json()) as { ok?: boolean; stage?: string; error?: string };
      if (data.ok && data.stage) {
        setStage(data.stage);
        onChanged?.(data.stage);
      } else {
        setError(data.error ?? 'Could not update the pipeline.');
      }
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Pipeline
        </h3>
        {current && (
          <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: current.gated ? '#b45309' : 'var(--text-faint)' }}>
            {current.gated ? 'Gated · ' : ''}Owner: {agentLabel(current.owner)}
          </span>
        )}
      </div>

      <Select
        value={stage}
        onChange={change}
        options={[
          ...(stage === '' ? [['', 'Not set'] as [string, string]] : []),
          ...PIPELINE_STAGES.map((s) => [s.id, s.label] as [string, string]),
        ]}
      />

      {/* Stage dots */}
      <div className="flex items-center gap-1 mt-3" aria-hidden>
        {PIPELINE_STAGES.map((s, i) => (
          <span
            key={s.id}
            title={s.label}
            className="h-1 flex-1 rounded-full"
            style={{ background: idx >= 0 && i <= idx ? 'var(--accent)' : 'var(--bg-raised)' }}
          />
        ))}
      </div>

      <p className="text-xs leading-relaxed mt-3" style={{ color: 'var(--text-muted)' }}>
        {busy ? 'Updating...' : current ? current.description : 'No pipeline stage set yet. Pick where this project stands.'}
      </p>
      {error && <p className="text-xs mt-1" style={{ color: '#e40014' }}>{error}</p>}
      <p className="font-spec text-[10px] mt-2" style={{ color: 'var(--text-faint)' }}>
        Every change is recorded on this client&apos;s channel in the Agents tab.
      </p>
    </div>
  );
}

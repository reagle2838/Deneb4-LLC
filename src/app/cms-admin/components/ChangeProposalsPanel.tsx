'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Pending change proposals from the Comms agent: structured, closed-menu
 * config changes parsed out of client feedback. Approving applies the
 * change to the client's build config and (when BUILDER_AUTORUN is on)
 * starts the Builder; rejecting discards it. Either way the decision is
 * recorded on the client's ledger channel.
 */

interface Proposal {
  id: string;
  status: 'proposed' | 'applied' | 'rejected';
  summary: string;
  patch: {
    set?: Record<string, string>;
    theme?: Record<string, string>;
    addModules?: string[];
    removeModules?: string[];
  };
  date: string;
  createdBy: string;
  note?: string;
}

export default function ChangeProposalsPanel({ slug }: { slug: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/changes?slug=${encodeURIComponent(slug)}`);
      const data = (await res.json()) as { ok?: boolean; proposals?: Proposal[] };
      if (data.ok) setProposals(data.proposals ?? []);
    } catch {
      /* panel is best-effort; the ledger is the record */
    } finally {
      setLoaded(true);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch('/api/agents/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action, id }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; builder?: string };
      if (!data.ok) setError(data.error ?? 'Could not update the proposal.');
      await refresh();
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusyId('');
    }
  }

  const pending = proposals.filter((p) => p.status === 'proposed');
  const recent = proposals.filter((p) => p.status !== 'proposed').slice(-2).reverse();
  if (loaded && pending.length === 0 && recent.length === 0) return null;

  const patchLines = (p: Proposal): string[] => {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(p.patch.set ?? {})) lines.push(`${k}: "${v}"`);
    if (p.patch.addModules?.length) lines.push(`add: ${p.patch.addModules.join(', ')}`);
    if (p.patch.removeModules?.length) lines.push(`remove: ${p.patch.removeModules.join(', ')}`);
    return lines;
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Change proposals
        </h3>
        {pending.length > 0 && (
          <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: '#b45309' }}>
            {pending.length} awaiting you
          </span>
        )}
      </div>

      {pending.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Nothing pending.</p>
      )}

      <div className="space-y-3">
        {pending.map((p) => (
          <div key={p.id} className="rounded p-3" style={{ border: '1px dashed #b45309', background: 'var(--bg-alt)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--text-heading)' }}>{p.summary}</p>
            <ul className="text-xs mb-2 space-y-0.5" style={{ color: 'var(--text-muted)' }}>
              {patchLines(p).map((l) => (
                <li key={l} className="font-spec">{l}</li>
              ))}
            </ul>
            {p.patch.theme && (
              <div className="flex flex-wrap gap-1.5 mb-2" aria-label="Proposed palette">
                {Object.entries(p.patch.theme).map(([token, rgb]) => (
                  <span key={token} title={`${token}: ${rgb}`} className="inline-flex items-center gap-1 text-[10px] font-spec" style={{ color: 'var(--text-faint)' }}>
                    <span className="inline-block w-4 h-4 rounded-sm" style={{ background: `rgb(${rgb.replace(/ /g, ',')})`, border: '1px solid var(--border-accent)' }} />
                    {token.replace('--', '')}
                  </span>
                ))}
              </div>
            )}
            <p className="font-spec text-[10px] mb-2" style={{ color: 'var(--text-faint)' }}>
              Proposed by {p.createdBy} · {new Date(p.date).toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => decide(p.id, 'approve')}
                disabled={busyId === p.id}
                className="btn-primary text-xs"
              >
                {busyId === p.id ? 'Working...' : 'Approve & apply'}
              </button>
              <button
                onClick={() => decide(p.id, 'reject')}
                disabled={busyId === p.id}
                className="btn-outline text-xs"
              >
                Reject
              </button>
            </div>
          </div>
        ))}

        {recent.map((p) => (
          <div key={p.id} className="rounded p-3" style={{ border: '1px solid var(--border-accent)', opacity: 0.75 }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="font-spec uppercase text-[10px] tracking-widest" style={{ color: p.status === 'applied' ? 'var(--accent-light)' : 'var(--text-faint)' }}>
                {p.status}
              </span>{' '}
              · {p.summary}
            </p>
            {p.note && <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>{p.note}</p>}
          </div>
        ))}
      </div>

      {error && <p className="text-xs mt-2" style={{ color: '#e40014' }}>{error}</p>}
      <p className="font-spec text-[10px] mt-3" style={{ color: 'var(--text-faint)' }}>
        Approving updates the build config; the Builder applies it, QAs it, and reverts automatically if checks fail.
      </p>
    </div>
  );
}

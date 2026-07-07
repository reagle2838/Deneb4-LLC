'use client';

import { useMemo, useState } from 'react';
import {
  agentLabel,
  STUDIO_CHANNEL,
  type LedgerEntry,
  type LedgerKind,
} from '@/lib/agent-roster';
import { inputStyle } from './fields';

const KIND_COLOR: Record<LedgerKind, string> = {
  message: 'var(--accent-light)',
  event: 'var(--text-faint)',
  handoff: '#7c3aed',
  alert: '#e40014',
  decision: '#15803d',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * The agents' shared workspace: one channel per client plus a Studio
 * channel. Agents write via /api/agents/ledger (x-agent-key); Ridhi
 * reads everything and can post notes/decisions to steer them.
 */
export default function AgentSpace({
  initialLedgers,
  clients,
}: {
  initialLedgers: Record<string, LedgerEntry[]>;
  clients: { slug: string; name: string }[];
}) {
  const [ledgers, setLedgers] = useState(initialLedgers);
  const [channel, setChannel] = useState(STUDIO_CHANNEL);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<LedgerKind>('message');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const channels = useMemo(() => {
    const known = new Map<string, string>();
    known.set(STUDIO_CHANNEL, 'Studio (business-wide)');
    for (const c of clients) known.set(c.slug, c.name);
    // Channels that have entries but no matching client (e.g. deleted clients)
    for (const key of Object.keys(ledgers)) {
      if (!known.has(key)) known.set(key, `${key} (archived)`);
    }
    return Array.from(known.entries());
  }, [clients, ledgers]);

  const entries = ledgers[channel] ?? [];
  const newestFirst = [...entries].reverse();

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const message = note.trim();
    if (!message) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/agents/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, agent: 'ridhi', kind, message }),
      });
      const data = (await res.json()) as { ok?: boolean; entry?: LedgerEntry; error?: string };
      if (data.ok && data.entry) {
        setLedgers((l) => ({ ...l, [channel]: [...(l[channel] ?? []), data.entry as LedgerEntry] }));
        setNote('');
      } else {
        setError(data.error ?? 'Could not post.');
      }
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Agent workspace</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
            The shared ledger the agents read and write, one channel per client. Notes and decisions you post here steer them.
          </p>
        </div>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="px-3 py-2 rounded-sm text-sm outline-none"
          style={inputStyle}
        >
          {channels.map(([slug, label]) => (
            <option key={slug} value={slug}>{label}</option>
          ))}
        </select>
      </div>

      {/* Composer */}
      <form onSubmit={post} className="card p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
            Post as Ridhi ·
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as LedgerKind)}
            className="px-2 py-1 rounded-sm text-xs outline-none"
            style={inputStyle}
          >
            <option value="message">Message</option>
            <option value="decision">Decision</option>
            <option value="alert">Alert</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Leave a note, instruction, or decision for the agents on this channel..."
            className="flex-1 px-3 py-2 rounded-sm text-sm outline-none"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <button type="submit" disabled={busy || !note.trim()} className="btn-primary text-sm flex-shrink-0">
            {busy ? '...' : 'Post'}
          </button>
        </div>
        {error && <p className="text-xs" style={{ color: '#e40014' }}>{error}</p>}
      </form>

      {/* Feed */}
      {newestFirst.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
            Nothing on this channel yet. Agent activity (events, handoffs, alerts, decisions) will appear here as the pipeline runs.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {newestFirst.map((entry) => (
            <div key={entry.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                <span className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>
                  {agentLabel(entry.agent)}
                </span>
                <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: KIND_COLOR[entry.kind] }}>
                  {entry.kind}
                </span>
                <span className="font-spec text-[10px] ml-auto" style={{ color: 'var(--text-faint)' }}>
                  {formatWhen(entry.date)}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {entry.message}
              </p>
              {Object.keys(entry.data).length > 0 && (
                <div className="mt-2 pt-2 space-y-0.5" style={{ borderTop: '1px solid var(--border-accent)' }}>
                  {Object.entries(entry.data).map(([k, v]) => (
                    <p key={k} className="font-spec text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      {k}: <span style={{ color: 'var(--text-muted)' }}>{v}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

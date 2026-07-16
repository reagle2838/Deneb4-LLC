'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The Engineer's work-order panel (docs/agents.md 2026-07-16): Ridhi
 * writes a work order (off-catalog custom work), the Engineer codes it on
 * a branch and QAs it unattended, and QA-green work comes back here for
 * her one-click Approve & merge.
 */

interface WorkOrder {
  id: string;
  spec: string;
  status: 'queued' | 'running' | 'review' | 'applied' | 'rejected' | 'failed';
  branch: string;
  summary?: string;
  diffstat?: string;
  note?: string;
  createdAt: string;
}

const STATUS_COLOR: Record<WorkOrder['status'], string> = {
  queued: 'var(--text-faint)',
  running: '#b45309',
  review: '#b45309',
  applied: '#15803d',
  rejected: 'var(--text-faint)',
  failed: '#e40014',
};

export default function EngineerPanel({ slug }: { slug: string }) {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [spec, setSpec] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/engineer?slug=${encodeURIComponent(slug)}`);
      const data = (await res.json()) as { ok?: boolean; orders?: WorkOrder[] };
      if (data.ok) setOrders(data.orders ?? []);
    } catch {
      /* best-effort; the ledger is the record */
    } finally {
      setLoaded(true);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
    // Orders run for minutes; poll gently while any is active.
    const t = setInterval(() => {
      setOrders((current) => {
        if (current.some((o) => o.status === 'queued' || o.status === 'running')) refresh();
        return current;
      });
    }, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  async function act(action: 'create' | 'approve' | 'reject', id?: string) {
    setBusy(id ?? 'create');
    setError('');
    try {
      const res = await fetch('/api/agents/engineer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action, ...(id ? { id } : {}), ...(action === 'create' ? { spec } : {}) }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) setError(data.error ?? 'Could not update the work order.');
      else if (action === 'create') setSpec('');
      await refresh();
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy('');
    }
  }

  const active = orders.filter((o) => !['applied', 'rejected'].includes(o.status)).reverse();
  const recent = orders.filter((o) => ['applied', 'rejected'].includes(o.status)).slice(-2).reverse();
  if (!loaded) return null;

  return (
    <div className="card p-5">
      <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
        Engineer · custom work orders
      </h3>

      <textarea
        value={spec}
        onChange={(e) => setSpec(e.target.value)}
        rows={3}
        placeholder='Describe the off-catalog change: what, where, any constraints. e.g. "Add a testimonials section to the home page under the logo wall, using quotes from their Drive copywriting doc: ..."'
        className="w-full text-xs rounded p-2 mb-2"
        style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-alt)', color: 'var(--text-heading)' }}
      />
      <button onClick={() => act('create')} disabled={busy !== '' || spec.trim().length < 10} className="btn-primary text-xs mb-3">
        {busy === 'create' ? 'Dispatching...' : 'Send work order'}
      </button>

      <div className="space-y-3">
        {active.map((o) => (
          <div key={o.id} className="rounded p-3" style={{ border: o.status === 'review' ? '1px dashed #b45309' : '1px solid var(--border-accent)', background: 'var(--bg-alt)' }}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: STATUS_COLOR[o.status] }}>
                {o.status === 'review' ? 'QA green — awaiting your review' : o.status}
              </span>
              <span className="font-spec text-[10px]" style={{ color: 'var(--text-faint)' }}>#{o.id}</span>
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--text-heading)' }}>{o.spec.slice(0, 200)}{o.spec.length > 200 ? '…' : ''}</p>
            {o.summary && <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{o.summary.slice(0, 300)}</p>}
            {o.diffstat && <p className="font-spec text-[10px] mb-2" style={{ color: 'var(--text-faint)' }}>{o.diffstat}</p>}
            {o.note && <p className="text-[11px] mb-2" style={{ color: '#e40014' }}>{o.note}</p>}
            {o.status === 'review' && (
              <div className="flex items-center gap-2">
                <button onClick={() => act('approve', o.id)} disabled={busy !== ''} className="btn-primary text-xs">
                  {busy === o.id ? 'Merging...' : 'Approve & merge'}
                </button>
                <button onClick={() => act('reject', o.id)} disabled={busy !== ''} className="btn-outline text-xs">
                  Reject
                </button>
              </div>
            )}
            {o.status === 'failed' && (
              <button onClick={() => act('reject', o.id)} disabled={busy !== ''} className="btn-outline text-xs">
                Discard (delete branch)
              </button>
            )}
          </div>
        ))}
        {recent.map((o) => (
          <div key={o.id} className="rounded p-3" style={{ border: '1px solid var(--border-accent)', opacity: 0.75 }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="font-spec uppercase text-[10px] tracking-widest" style={{ color: STATUS_COLOR[o.status] }}>{o.status}</span>
              {' '}· {o.spec.slice(0, 120)}
            </p>
            {o.note && <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>{o.note}</p>}
          </div>
        ))}
      </div>

      {error && <p className="text-xs mt-2" style={{ color: '#e40014' }}>{error}</p>}
      <p className="font-spec text-[10px] mt-3" style={{ color: 'var(--text-faint)' }}>
        The Engineer codes on an isolated branch, runs the full QA battery, and only QA-green work reaches you. Approving merges to main{'; '}failures keep their branch for inspection.
      </p>
    </div>
  );
}

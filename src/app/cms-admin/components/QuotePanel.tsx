'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The quote gate (Phase 14, HITL touchpoint #1). The agent drafts a quote
 * from the intake the moment it lands; this panel is where Ridhi approves
 * it (sending it to the client for confirmation) or denies it WITH
 * INSTRUCTIONS — the agent revises the config/adjustment per her notes and
 * re-proposes. After the client confirms, the deposit invoice drafts on
 * the Billing panel, and the paid deposit starts the build.
 */

interface QuoteRecordView {
  id: string;
  status: 'pending_ridhi' | 'pending_client' | 'confirmed' | 'withdrawn';
  quote: {
    lines: { label: string; amount: number }[];
    total: number;
    costFloor: number;
    marginMultiple: number;
    marginOk: boolean;
  };
  adjustmentUsd: number;
  updatedAt: string;
  history: { at: string; by: string; action: string; note?: string }[];
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_LABEL: Record<QuoteRecordView['status'], string> = {
  pending_ridhi: 'Awaiting your approval',
  pending_client: "Awaiting the client's confirmation",
  confirmed: 'Confirmed by the client',
  withdrawn: 'Withdrawn',
};

export default function QuotePanel({ slug }: { slug: string }) {
  const [record, setRecord] = useState<QuoteRecordView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [denying, setDenying] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/quotes?slug=${encodeURIComponent(slug)}`);
      const data = (await res.json()) as { ok?: boolean; quote?: QuoteRecordView | null };
      if (data.ok) setRecord(data.quote ?? null);
    } catch {
      /* panel is best-effort; the ledger is the record */
    } finally {
      setLoaded(true);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function act(action: 'draft' | 'approve' | 'deny') {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/agents/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action, ...(action === 'deny' ? { instructions } : {}) }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) setError(data.error ?? 'Could not update the quote.');
      else {
        setDenying(false);
        setInstructions('');
      }
      await refresh();
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loaded && !record) {
    return (
      <div className="card p-5">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
          Quote
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-faint)' }}>
          No quote yet. It drafts itself when an intake is staged; or price the current config now.
        </p>
        <button onClick={() => act('draft')} disabled={busy} className="btn-outline text-xs">
          {busy ? 'Working...' : 'Draft a quote'}
        </button>
        {error && <p className="text-xs mt-2" style={{ color: '#e40014' }}>{error}</p>}
      </div>
    );
  }
  if (!record) return null;

  const total = Math.round((record.quote.total + record.adjustmentUsd) * 100) / 100;
  const awaitingRidhi = record.status === 'pending_ridhi';
  const lastDenial = [...record.history].reverse().find((h) => h.action === 'denied');

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Quote
        </h3>
        <span
          className="font-spec text-[10px] tracking-widest uppercase"
          style={{ color: awaitingRidhi ? '#b45309' : record.status === 'confirmed' ? 'var(--accent-light)' : 'var(--text-faint)' }}
        >
          {STATUS_LABEL[record.status]}
        </span>
      </div>

      <ul className="text-xs mb-2 space-y-0.5" style={{ color: 'var(--text-muted)' }}>
        {record.quote.lines.map((l) => (
          <li key={l.label} className="flex justify-between gap-3">
            <span>{l.label}</span>
            <span className="font-spec whitespace-nowrap">{money(l.amount)}</span>
          </li>
        ))}
        {record.adjustmentUsd !== 0 && (
          <li className="flex justify-between gap-3">
            <span>Adjustment (per your instructions)</span>
            <span className="font-spec whitespace-nowrap">{money(record.adjustmentUsd)}</span>
          </li>
        )}
      </ul>
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
        Total {money(total)} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(50% deposit, 50% at handoff)</span>
      </p>
      <p className="font-spec text-[10px] mb-3" style={{ color: record.quote.marginOk ? 'var(--text-faint)' : '#e40014' }}>
        Cost floor {money(record.quote.costFloor)} · {record.quote.marginMultiple}x margin{record.quote.marginOk ? '' : ' — BELOW GUARDRAIL'}
      </p>

      {awaitingRidhi && !denying && (
        <div className="flex items-center gap-2">
          <button onClick={() => act('approve')} disabled={busy} className="btn-primary text-xs">
            {busy ? 'Working...' : 'Approve & send to client'}
          </button>
          <button onClick={() => setDenying(true)} disabled={busy} className="btn-outline text-xs">
            Deny with instructions
          </button>
        </div>
      )}

      {awaitingRidhi && denying && (
        <div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            placeholder='What should change? e.g. "remove the blog", "add the gallery", "$200 off"'
            className="w-full text-xs rounded p-2 mb-2"
            style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-alt)', color: 'var(--text-heading)' }}
          />
          <div className="flex items-center gap-2">
            <button onClick={() => act('deny')} disabled={busy || !instructions.trim()} className="btn-primary text-xs">
              {busy ? 'Working...' : 'Send instructions to the agent'}
            </button>
            <button onClick={() => { setDenying(false); setInstructions(''); }} disabled={busy} className="btn-outline text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      {record.status === 'pending_client' && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          The client has an Approve item in their portal (and an email). Their confirmation drafts the deposit invoice automatically.
        </p>
      )}
      {record.status === 'confirmed' && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Confirmed. The deposit invoice is on the Billing panel — the build starts by itself once it's paid.
        </p>
      )}

      {lastDenial?.note && awaitingRidhi && (
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
          Your last instructions: &ldquo;{lastDenial.note}&rdquo;
        </p>
      )}
      {error && <p className="text-xs mt-2" style={{ color: '#e40014' }}>{error}</p>}
    </div>
  );
}

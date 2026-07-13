'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The Billing panel: the invoice send gate. The agent drafts invoices from
 * the quote (deposit at build start, balance at sign-off); nothing reaches
 * the client until "Approve & send" here. Also shows the quote's economics
 * (total vs cost floor vs margin) and lets Ridhi log a consultation call,
 * which flows into both the cost floor and the final invoice.
 */

interface QuoteLine { label: string; amount: number }
interface QuoteData {
  lines: QuoteLine[];
  total: number;
  deposit: number;
  costFloor: number;
  costLines: QuoteLine[];
  marginMultiple: number;
  marginOk: boolean;
}
interface ProposedInvoice {
  id: string;
  kind: 'deposit' | 'final';
  description: string;
  amount: number;
  dueDate: string;
  lines: { label: string; amount: string }[];
  status: 'proposed' | 'sent' | 'rejected';
  note?: string;
}
interface CostEntry {
  kind: 'build-api' | 'resend' | 'elevenlabs-call' | 'other';
  amount: number;
  note: string;
}

const KIND_LABEL: Record<CostEntry['kind'], string> = {
  'build-api': 'Claude API',
  resend: 'Resend',
  'elevenlabs-call': 'ElevenLabs',
  other: 'Other',
};

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Individual API-usage costs can be fractions of a cent; the 2-decimal
// formatter above would round real usage down to a misleading "$0.00".
const moneyPrecise = (n: number) => (n > 0 && n < 0.01 ? `$${n.toFixed(4)}` : money(n));

export default function BillingPanel({ slug }: { slug: string }) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [proposed, setProposed] = useState<ProposedInvoice[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callMinutes, setCallMinutes] = useState(30);
  const [callSummary, setCallSummary] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/billing?slug=${encodeURIComponent(slug)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        quote?: QuoteData | null;
        proposed?: ProposedInvoice[];
        costs?: CostEntry[];
      };
      if (data.ok) {
        setQuote(data.quote ?? null);
        setProposed(data.proposed ?? []);
        setCosts(data.costs ?? []);
      }
    } catch {
      /* best-effort; the ledger is the record */
    } finally {
      setLoaded(true);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function act(action: string, id?: string, extra?: Record<string, unknown>) {
    setBusyId(id ?? action);
    setError('');
    try {
      const res = await fetch('/api/agents/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action, id, ...extra }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) setError(data.error ?? 'Action failed.');
      else if (action === 'log-consultation') {
        setCallSummary('');
        setCallOpen(false);
      }
      await refresh();
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusyId('');
    }
  }

  const pending = proposed.filter((p) => p.status === 'proposed');
  const recent = proposed.filter((p) => p.status !== 'proposed').slice(-2).reverse();
  if (loaded && !quote && pending.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Billing
        </h3>
        {pending.length > 0 && (
          <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: '#b45309' }}>
            {pending.length} awaiting your send
          </span>
        )}
      </div>

      {quote && (
        <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-baseline justify-between">
            <span>Quote total</span>
            <span className="font-spec" style={{ color: 'var(--text-heading)' }}>{money(quote.total)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span>Cost floor · margin</span>
            <span className="font-spec" style={{ color: quote.marginOk ? 'var(--text-faint)' : '#e40014' }}>
              {money(quote.costFloor)} · {quote.marginMultiple}x{quote.marginOk ? '' : ' (below guardrail!)'}
            </span>
          </div>
          {quote.costLines.map((l) => (
            <div key={l.label} className="flex items-baseline justify-between pl-2">
              <span style={{ color: 'var(--text-faint)' }}>{l.label}</span>
              <span className="font-spec" style={{ color: 'var(--text-faint)' }}>{money(l.amount)}</span>
            </div>
          ))}

          {costs.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer" style={{ color: 'var(--text-faint)' }}>
                {costs.length} real cost{costs.length === 1 ? '' : 's'} recorded (this project's actual API/email/call usage)
              </summary>
              <div className="mt-1 space-y-0.5 pl-2">
                {costs.map((c, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <span className="truncate" style={{ color: 'var(--text-faint)' }} title={c.note}>{KIND_LABEL[c.kind]}: {c.note}</span>
                    <span className="font-spec whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>{moneyPrecise(c.amount)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="space-y-3">
        {pending.map((p) => (
          <div key={p.id} className="rounded p-3" style={{ border: '1px dashed #b45309', background: 'var(--bg-alt)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--text-heading)' }}>
              {p.description} — <span className="font-spec">{money(p.amount)}</span> <span className="text-xs" style={{ color: 'var(--text-faint)' }}>due {p.dueDate}</span>
            </p>
            <ul className="text-[11px] mb-2 space-y-0.5" style={{ color: 'var(--text-muted)' }}>
              {p.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3"><span>{l.label}</span><span className="font-spec whitespace-nowrap">{l.amount}</span></li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <button onClick={() => act('approve-send', p.id)} disabled={busyId === p.id} className="btn-primary text-xs">
                {busyId === p.id ? 'Sending...' : 'Approve & send'}
              </button>
              <button onClick={() => act('reject', p.id)} disabled={busyId === p.id} className="btn-outline text-xs">
                Reject
              </button>
            </div>
          </div>
        ))}

        {recent.map((p) => (
          <div key={p.id} className="rounded p-3" style={{ border: '1px solid var(--border-accent)', opacity: 0.75 }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="font-spec uppercase text-[10px] tracking-widest" style={{ color: p.status === 'sent' ? 'var(--accent-light)' : 'var(--text-faint)' }}>
                {p.status}
              </span>{' '}
              · {p.description} ({money(p.amount)}){p.note ? ` — ${p.note}` : ''}
            </p>
          </div>
        ))}
      </div>

      {error && <p className="text-xs mt-2" style={{ color: '#e40014' }}>{error}</p>}

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-accent)' }}>
        <div className="flex items-center justify-between">
          <button onClick={() => setCallOpen((o) => !o)} className="btn-outline text-xs">
            {callOpen ? 'Cancel' : 'Log a phone consultation'}
          </button>
          <p className="font-spec text-[10px]" style={{ color: 'var(--text-faint)' }}>
            Pricing lives in content/admin/pricing.yaml
          </p>
        </div>
        {callOpen && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Minutes:</label>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={callMinutes}
                onChange={(e) => setCallMinutes(Number(e.target.value) || 30)}
                className="text-xs px-2 py-1 rounded-sm w-20"
                style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)' }}
              />
              <span className="font-spec text-[10px]" style={{ color: 'var(--text-faint)' }}>
                billed per 30-min block on the final invoice
              </span>
            </div>
            <textarea
              value={callSummary}
              onChange={(e) => setCallSummary(e.target.value)}
              placeholder="What was discussed, decided, or promised on the call? (required — this is the record)"
              className="text-xs px-2 py-1.5 rounded-sm w-full"
              style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)', minHeight: '4rem' }}
            />
            <button
              onClick={() => act('log-consultation', undefined, { durationMin: callMinutes, summary: callSummary })}
              disabled={busyId === 'log-consultation' || !callSummary.trim()}
              className="btn-primary text-xs"
            >
              {busyId === 'log-consultation' ? 'Saving...' : 'Save call record'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

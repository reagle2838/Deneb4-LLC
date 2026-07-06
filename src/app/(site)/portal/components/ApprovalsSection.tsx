'use client';

import { useState } from 'react';
import type { ClientUpdate } from '@/lib/clients';
import { formatFriendlyDate } from '@/lib/format';

/**
 * One prominent card per update that is waiting for the client's sign-off,
 * with a big Approve button and an escape hatch to ask a question first.
 */
export default function ApprovalsSection({
  updates,
  onUpdated,
}: {
  updates: ClientUpdate[];
  onUpdated: (updates: ClientUpdate[]) => void;
}) {
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [justApproved, setJustApproved] = useState<string[]>([]);

  const pending = updates
    .map((u, index) => ({ u, index }))
    .filter(({ u }) => u.status === 'pending-signoff');

  if (pending.length === 0 && justApproved.length === 0) return null;

  async function approve(index: number, phase: string) {
    setBusyIndex(index);
    setError('');
    try {
      const res = await fetch('/api/portal-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, phase }),
      });
      const data = (await res.json()) as { ok?: boolean; updates?: ClientUpdate[]; error?: string };
      if (data.ok && data.updates) {
        onUpdated(data.updates);
        setJustApproved((prev) => [...prev, phase]);
      } else {
        setError(data.error ?? 'Something went wrong. Please refresh the page and try again.');
      }
    } catch {
      setError('Something went wrong. Please refresh the page and try again.');
    } finally {
      setBusyIndex(null);
    }
  }

  function askFirst() {
    document.getElementById('messages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div id="approvals" className="mb-6 scroll-mt-24">
      <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-heading)' }}>
        Waiting for <span style={{ color: 'var(--accent-light)' }}>your approval</span>
      </h2>
      {error && <p className="text-sm mb-3" style={{ color: '#e40014' }}>{error}</p>}
      <div className="space-y-3">
        {pending.map(({ u, index }) => (
          <div key={`${u.phase}-${index}`} className="card p-6" style={{ borderColor: '#b45309' }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>{u.phase}</p>
                {u.notes && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{u.notes}</p>}
                {u.date && (
                  <p className="font-spec text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>{formatFriendlyDate(u.date)}</p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <button
                  onClick={() => approve(index, u.phase)}
                  disabled={busyIndex !== null}
                  className="btn-primary"
                >
                  {busyIndex === index ? 'Approving...' : 'Approve'}
                </button>
                <button onClick={askFirst} className="btn-outline text-sm">Ask a question first</button>
              </div>
            </div>
          </div>
        ))}
        {justApproved.map((phase) => (
          <div key={phase} className="card p-5" style={{ borderColor: '#15803d' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="font-semibold" style={{ color: '#15803d' }}>Approved.</span> Thank you! We&apos;ve been
              notified and &quot;{phase}&quot; is marked done.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

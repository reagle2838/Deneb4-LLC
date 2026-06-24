'use client';

import { useState } from 'react';
import type { Client, ClientFeedback } from '@/lib/clients';

function lastDate(thread: ClientFeedback[]): string {
  return thread.length ? thread[thread.length - 1].date : '';
}

export default function FeedbackTab({ initialClients }: { initialClients: Client[] }) {
  const [threads, setThreads] = useState<Record<string, ClientFeedback[]>>(() =>
    Object.fromEntries(initialClients.map((c) => [c.slug, c.feedback]))
  );
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});

  async function post(payload: Record<string, unknown>) {
    const res = await fetch('/api/clients/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as { ok?: boolean; entry?: ClientFeedback; error?: string };
  }

  async function saveEdit(slug: string, id: string) {
    const text = editText.trim();
    if (!text) return;
    const data = await post({ slug, action: 'edit', id, message: text });
    if (data.ok) {
      setThreads((t) => ({ ...t, [slug]: (t[slug] ?? []).map((m) => (m.id === id ? { ...m, message: text } : m)) }));
      setEditingId(null);
    } else {
      setError(data.error ?? 'Could not save.');
    }
  }

  async function removeMsg(slug: string, id: string) {
    if (!window.confirm('Delete this message?')) return;
    const data = await post({ slug, action: 'delete', id });
    if (data.ok) setThreads((t) => ({ ...t, [slug]: (t[slug] ?? []).filter((m) => m.id !== id) }));
    else setError(data.error ?? 'Could not delete.');
  }

  async function resolveThread(slug: string, name: string) {
    if (!window.confirm(`Mark all open feedback with ${name} resolved? It moves to history (still viewable by both of you) and clears from the open list.`)) return;
    setBusy(slug);
    setError('');
    const data = await post({ slug, action: 'resolve' });
    if (data.ok) setThreads((t) => ({ ...t, [slug]: (t[slug] ?? []).map((m) => ({ ...m, resolved: true, read: true })) }));
    else setError(data.error ?? 'Could not resolve.');
    setBusy(null);
  }

  const names: Record<string, string> = Object.fromEntries(initialClients.map((c) => [c.slug, c.name]));

  const clientsWithFeedback = initialClients
    .filter((c) => (threads[c.slug] ?? []).length > 0)
    .sort((a, b) => lastDate(threads[b.slug] ?? []).localeCompare(lastDate(threads[a.slug] ?? [])));

  function unread(slug: string): number {
    return (threads[slug] ?? []).filter((m) => m.author === 'client' && !m.read && !m.resolved).length;
  }

  async function sendReply(slug: string) {
    const message = (reply[slug] ?? '').trim();
    if (!message) return;
    setBusy(slug);
    setError('');
    try {
      const res = await fetch('/api/clients/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action: 'reply', message }),
      });
      const data = (await res.json()) as { ok?: boolean; entry?: ClientFeedback; error?: string };
      if (data.ok && data.entry) {
        setThreads((t) => ({
          ...t,
          [slug]: [...(t[slug] ?? []).map((m) => ({ ...m, read: true })), data.entry as ClientFeedback],
        }));
        setReply((r) => ({ ...r, [slug]: '' }));
      } else {
        setError(data.error ?? 'Could not send reply.');
      }
    } catch {
      setError('Server error — try again.');
    } finally {
      setBusy(null);
    }
  }

  async function markRead(slug: string) {
    setBusy(slug);
    setError('');
    try {
      const res = await fetch('/api/clients/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action: 'markRead' }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setThreads((t) => ({ ...t, [slug]: (t[slug] ?? []).map((m) => ({ ...m, read: true })) }));
      } else {
        setError(data.error ?? 'Could not update.');
      }
    } catch {
      setError('Server error — try again.');
    } finally {
      setBusy(null);
    }
  }

  function bubble(slug: string, m: ClientFeedback, editable: boolean) {
    const fromClient = m.author === 'client';
    const mine = !fromClient;
    const editing = editingId === m.id;
    return (
      <div
        key={m.id}
        className="px-3 py-2 rounded-sm text-sm max-w-[85%]"
        style={{ marginLeft: fromClient ? 0 : 'auto', background: fromClient ? 'var(--bg-alt)' : 'rgba(0,107,143,0.08)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)' }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: fromClient ? 'var(--text-faint)' : 'var(--accent-light)' }}>{fromClient ? names[slug] : 'You'}</span>
          {m.resolved && <span className="font-spec text-[9px] tracking-widest px-1 rounded" style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}>RESOLVED</span>}
          {m.page && <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>· {m.page}</span>}
          {m.date && <span className="font-spec text-[10px] ml-auto" style={{ color: 'var(--text-faint)' }}>{new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
        </div>
        {editing ? (
          <div>
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} className="w-full px-2 py-1 rounded-sm text-sm outline-none" style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)', resize: 'vertical' }} />
            <div className="flex gap-3 mt-1">
              <button onClick={() => saveEdit(slug, m.id)} className="text-[11px] font-spec" style={{ color: 'var(--accent-light)' }}>Save</button>
              <button onClick={() => setEditingId(null)} className="text-[11px] font-spec" style={{ color: 'var(--text-faint)' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
            {editable && mine && (
              <div className="flex gap-3 mt-1">
                <button onClick={() => { setEditingId(m.id); setEditText(m.message); }} className="text-[11px] font-spec" style={{ color: 'var(--text-faint)' }}>Edit</button>
                <button onClick={() => removeMsg(slug, m.id)} className="text-[11px] font-spec" style={{ color: '#e40014' }}>Delete</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (clientsWithFeedback.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No client feedback yet. Comments clients leave on their staging site appear here.</p>;
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-xs" style={{ color: '#e40014' }}>{error}</p>}
      {clientsWithFeedback.map((c) => {
        const thread = threads[c.slug] ?? [];
        const active = thread.filter((m) => !m.resolved);
        const resolved = thread.filter((m) => m.resolved);
        const n = unread(c.slug);
        return (
          <div key={c.slug} className="card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold" style={{ color: 'var(--text-heading)' }}>{names[c.slug]}</h3>
                {n > 0 && (
                  <span className="font-spec text-[10px] tracking-widest px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)', color: '#fff' }}>{n} NEW</span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {n > 0 && (
                  <button onClick={() => markRead(c.slug)} disabled={busy === c.slug} className="text-xs font-spec" style={{ color: 'var(--text-faint)' }}>Mark read</button>
                )}
                {active.length > 0 && (
                  <button onClick={() => resolveThread(c.slug, names[c.slug])} disabled={busy === c.slug} className="text-xs font-spec" style={{ color: '#16a34a' }}>Resolve &amp; clear</button>
                )}
              </div>
            </div>

            {active.length > 0 && <div className="space-y-2 mb-4">{active.map((m) => bubble(c.slug, m, true))}</div>}
            {active.length === 0 && <p className="text-sm mb-4" style={{ color: 'var(--text-faint)' }}>No open feedback.</p>}

            <div className="flex items-end gap-2">
              <textarea
                value={reply[c.slug] ?? ''}
                onChange={(e) => setReply((r) => ({ ...r, [c.slug]: e.target.value }))}
                rows={2}
                placeholder="Reply to this client..."
                className="flex-1 px-3 py-2 rounded-sm text-sm outline-none"
                style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)', resize: 'vertical' }}
              />
              <button onClick={() => sendReply(c.slug)} disabled={busy === c.slug || !(reply[c.slug] ?? '').trim()} className="btn-primary text-sm flex-shrink-0">
                {busy === c.slug ? '...' : 'Reply'}
              </button>
            </div>

            {resolved.length > 0 && (
              <div className="mt-4">
                <button type="button" onClick={() => setHistoryOpen((h) => ({ ...h, [c.slug]: !h[c.slug] }))} className="text-xs font-spec" style={{ color: 'var(--text-faint)' }}>
                  {historyOpen[c.slug] ? 'Hide' : 'Show'} resolved history ({resolved.length})
                </button>
                {historyOpen[c.slug] && <div className="space-y-2 mt-2" style={{ opacity: 0.8 }}>{resolved.map((m) => bubble(c.slug, m, false))}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

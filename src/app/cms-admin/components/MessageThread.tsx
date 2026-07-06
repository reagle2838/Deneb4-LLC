'use client';

import { useState } from 'react';
import type { ClientFeedback } from '@/lib/clients';
import { inputStyle } from './fields';

/**
 * Owner-side message thread for one client: reply, mark read, resolve,
 * edit/delete own messages. Used by both the Messages inbox and the
 * per-client command center.
 */
export default function MessageThread({
  slug,
  clientName,
  initial,
}: {
  slug: string;
  clientName: string;
  initial: ClientFeedback[];
}) {
  const [thread, setThread] = useState<ClientFeedback[]>(initial);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  async function post(payload: Record<string, unknown>) {
    const res = await fetch('/api/clients/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, ...payload }),
    });
    return (await res.json()) as { ok?: boolean; entry?: ClientFeedback; error?: string };
  }

  async function sendReply() {
    const message = reply.trim();
    if (!message) return;
    setBusy(true);
    setError('');
    try {
      const data = await post({ action: 'reply', message });
      if (data.ok && data.entry) {
        setThread((t) => [...t.map((m) => ({ ...m, read: true })), data.entry as ClientFeedback]);
        setReply('');
      } else {
        setError(data.error ?? 'Could not send reply.');
      }
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
  }

  async function markRead() {
    setBusy(true);
    setError('');
    const data = await post({ action: 'markRead' });
    if (data.ok) setThread((t) => t.map((m) => ({ ...m, read: true })));
    else setError(data.error ?? 'Could not update.');
    setBusy(false);
  }

  async function resolveThread() {
    if (!window.confirm(`Mark all open messages with ${clientName} resolved? They move to history (still viewable by both of you).`)) return;
    setBusy(true);
    setError('');
    const data = await post({ action: 'resolve' });
    if (data.ok) setThread((t) => t.map((m) => ({ ...m, resolved: true, read: true })));
    else setError(data.error ?? 'Could not resolve.');
    setBusy(false);
  }

  async function saveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    const data = await post({ action: 'edit', id, message: text });
    if (data.ok) {
      setThread((t) => t.map((m) => (m.id === id ? { ...m, message: text } : m)));
      setEditingId(null);
    } else {
      setError(data.error ?? 'Could not save.');
    }
  }

  async function removeMsg(id: string) {
    if (!window.confirm('Delete this message?')) return;
    const data = await post({ action: 'delete', id });
    if (data.ok) setThread((t) => t.filter((m) => m.id !== id));
    else setError(data.error ?? 'Could not delete.');
  }

  const active = thread.filter((m) => !m.resolved);
  const resolved = thread.filter((m) => m.resolved);
  const unread = active.filter((m) => m.author === 'client' && !m.read).length;

  function bubble(m: ClientFeedback, editable: boolean) {
    const fromClient = m.author === 'client';
    const editing = editingId === m.id;
    return (
      <div
        key={m.id}
        className="px-3 py-2 rounded-sm text-sm max-w-[85%]"
        style={{
          marginLeft: fromClient ? 0 : 'auto',
          background: fromClient ? 'var(--bg-alt)' : 'rgba(0,107,143,0.08)',
          border: '1px solid var(--border-accent)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: fromClient ? 'var(--text-faint)' : 'var(--accent-light)' }}>
            {fromClient ? clientName : 'You'}
          </span>
          {m.resolved && <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: '#15803d' }}>Resolved</span>}
          {m.page && <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>· {m.page}</span>}
          {m.date && (
            <span className="font-spec text-[10px] ml-auto" style={{ color: 'var(--text-faint)' }}>
              {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {editing ? (
          <div>
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} className="w-full px-2 py-1 rounded-sm text-sm outline-none" style={{ ...inputStyle, resize: 'vertical' }} />
            <div className="flex gap-3 mt-1">
              <button onClick={() => saveEdit(m.id)} className="text-[11px] font-spec" style={{ color: 'var(--accent-light)' }}>Save</button>
              <button onClick={() => setEditingId(null)} className="text-[11px] font-spec" style={{ color: 'var(--text-faint)' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
            {editable && !fromClient && (
              <div className="flex gap-3 mt-1">
                <button onClick={() => { setEditingId(m.id); setEditText(m.message); }} className="text-[11px] font-spec" style={{ color: 'var(--text-faint)' }}>Edit</button>
                <button onClick={() => removeMsg(m.id)} className="text-[11px] font-spec" style={{ color: '#e40014' }}>Delete</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <span className="font-spec text-[11px] tracking-widest uppercase" style={{ color: 'var(--accent-light)' }}>
              {unread} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {unread > 0 && (
            <button onClick={markRead} disabled={busy} className="text-xs font-spec" style={{ color: 'var(--text-faint)' }}>Mark read</button>
          )}
          {active.length > 0 && (
            <button onClick={resolveThread} disabled={busy} className="text-xs font-spec" style={{ color: '#15803d' }}>Resolve &amp; clear</button>
          )}
        </div>
      </div>

      {error && <p className="text-xs mb-2" style={{ color: '#e40014' }}>{error}</p>}

      {active.length > 0 ? (
        <div className="space-y-2 mb-3">{active.map((m) => bubble(m, true))}</div>
      ) : (
        <p className="text-sm mb-3" style={{ color: 'var(--text-faint)' }}>No open messages.</p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
          placeholder={`Reply to ${clientName}... (they get an email)`}
          className="flex-1 px-3 py-2 rounded-sm text-sm outline-none"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <button onClick={sendReply} disabled={busy || !reply.trim()} className="btn-primary text-sm flex-shrink-0">
          {busy ? '...' : 'Reply'}
        </button>
      </div>

      {resolved.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setHistoryOpen((v) => !v)} className="text-xs font-spec" style={{ color: 'var(--text-faint)' }}>
            {historyOpen ? 'Hide' : 'Show'} resolved history ({resolved.length})
          </button>
          {historyOpen && <div className="space-y-2 mt-2" style={{ opacity: 0.8 }}>{resolved.map((m) => bubble(m, false))}</div>}
        </div>
      )}
    </div>
  );
}

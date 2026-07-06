'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClientFeedback } from '@/lib/clients';

/**
 * The client's message thread with Deneb4, inline in the portal.
 * Posting, editing and deleting their own messages; resolved history
 * collapses. Scrolling the section into view marks the thread seen
 * (clears the unread indicator server-side).
 */
export default function MessagesSection({
  initial,
  canComment,
  unread,
  onSeen,
}: {
  initial: ClientFeedback[];
  canComment: boolean;
  unread: number;
  onSeen: () => void;
}) {
  const [thread, setThread] = useState<ClientFeedback[]>(initial);
  const [page, setPage] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const seenSent = useRef(false);

  // Mark the thread seen once the client actually scrolls it into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !seenSent.current) {
            seenSent.current = true;
            io.disconnect();
            fetch('/api/portal-feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'seen' }),
            }).catch(() => {});
            onSeen();
          }
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onSeen]);

  async function post(payload: Record<string, unknown>) {
    const res = await fetch('/api/portal-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as { ok?: boolean; entry?: ClientFeedback; error?: string };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError('');
    try {
      const data = await post({ message, page });
      if (data.ok && data.entry) {
        setThread((t) => [...t, data.entry as ClientFeedback]);
        setMessage('');
        setPage('');
      } else {
        setError(data.error ?? 'Could not send. Try again.');
      }
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
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

  async function remove(id: string) {
    if (!window.confirm('Delete this message?')) return;
    const data = await post({ action: 'delete', id });
    if (data.ok) setThread((t) => t.filter((m) => m.id !== id));
    else setError(data.error ?? 'Could not delete.');
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--border-accent)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
  };

  const active = thread.filter((m) => !m.resolved);
  const resolved = thread.filter((m) => m.resolved);

  function bubble(m: ClientFeedback, editable: boolean) {
    const mine = m.author === 'client';
    const editing = editingId === m.id;
    return (
      <div
        key={m.id}
        className="px-4 py-3 rounded-sm text-sm"
        style={{ background: mine ? 'rgba(0,107,143,0.08)' : 'var(--bg-alt)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)' }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: mine ? 'var(--accent-light)' : 'var(--text-faint)' }}>{mine ? 'You' : 'Deneb4'}</span>
          {m.resolved && <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: '#15803d' }}>Resolved</span>}
          {m.page && <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>· {m.page}</span>}
          {m.date && <span className="font-spec text-[10px] ml-auto" style={{ color: 'var(--text-faint)' }}>{new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
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
            {editable && mine && (
              <div className="flex gap-3 mt-1">
                <button onClick={() => { setEditingId(m.id); setEditText(m.message); }} className="text-[11px] font-spec" style={{ color: 'var(--text-faint)' }}>Edit</button>
                <button onClick={() => remove(m.id)} className="text-[11px] font-spec" style={{ color: '#e40014' }}>Delete</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div id="messages" ref={sectionRef} className="card p-6 mb-6 scroll-mt-24">
      <div className="flex items-center gap-3 mb-1">
        <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Messages</h2>
        {unread > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-light)' }} />
            <span className="font-spec text-[11px] tracking-widest uppercase" style={{ color: 'var(--accent-light)' }}>
              {unread} new
            </span>
          </span>
        )}
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        {canComment
          ? 'Write to us here about anything: questions, changes, things you spotted. We reply right in this thread and you get an email when we do.'
          : 'Messaging is paused for now. Your conversation history stays available below.'}
      </p>

      {active.length > 0 && <div className="space-y-2 mb-4">{active.map((m) => bubble(m, canComment))}</div>}

      {canComment && (
        <form onSubmit={submit} className="space-y-2">
          <input
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder="Which page or topic is this about? (optional)"
            className="w-full px-3 py-2.5 rounded-sm text-sm outline-none"
            style={inputStyle}
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Type your message here..."
            className="w-full px-3 py-2.5 rounded-sm text-sm outline-none"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          {error && <p className="text-xs" style={{ color: '#e40014' }}>{error}</p>}
          <button type="submit" disabled={busy || !message.trim()} className="btn-primary w-full justify-center">
            {busy ? 'Sending...' : 'Send message'}
          </button>
        </form>
      )}

      {resolved.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-xs font-spec" style={{ color: 'var(--text-faint)' }}>
            {showHistory ? 'Hide' : 'Show'} older messages ({resolved.length})
          </button>
          {showHistory && <div className="space-y-2 mt-2" style={{ opacity: 0.8 }}>{resolved.map((m) => bubble(m, false))}</div>}
        </div>
      )}
    </div>
  );
}

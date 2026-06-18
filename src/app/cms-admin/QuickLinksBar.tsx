'use client';

import { useState } from 'react';
import type { QuickLink } from '@/lib/quick-links';

const ICON_OPTIONS = [
  '🔗', '🌐', '📁', '🗂️', '📄', '📊', '📈', '📅', '📧', '💬',
  '🎨', '🛠️', '⚙️', '💳', '✅', '🔍', '☁️', '🤖', '📷', '🔑',
  '📝', '💡', '🚀', '⭐', '📌', '🧰', '🖥️', '📦', '🔔', '🏦',
];

function normHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function QuickLinksBar({ initialLinks }: { initialLinks: QuickLink[] }) {
  const [links, setLinks] = useState<QuickLink[]>(initialLinks);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QuickLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [iconPicker, setIconPicker] = useState<number | null>(null);

  function startEdit() {
    setDraft(links.length ? links.map((l) => ({ ...l })) : [{ label: '', url: '', icon: '🔗' }]);
    setIconPicker(null);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    const clean = draft.map((l) => ({ label: l.label.trim(), url: l.url.trim(), icon: l.icon || '🔗' })).filter((l) => l.url);
    try {
      const res = await fetch('/api/quick-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links: clean }) });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        setLinks(clean);
        setEditing(false);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4 flex-1 min-w-[260px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Quick Links</span>
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(false)} disabled={busy} className="text-xs font-spec" style={{ color: 'var(--text-faint)' }}>Cancel</button>
            <button onClick={save} disabled={busy} className="text-xs font-spec font-semibold" style={{ color: 'var(--accent-light)' }}>{busy ? 'Saving...' : 'Save'}</button>
          </div>
        ) : (
          <button onClick={startEdit} className="text-xs font-spec font-semibold" style={{ color: 'var(--accent-light)' }}>{links.length ? 'Edit' : '+ Add'}</button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {draft.map((l, i) => (
            <div key={i} className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => setIconPicker((p) => (p === i ? null : i))}
                className="rounded-sm text-lg text-center flex-shrink-0"
                style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', width: '40px', height: '34px', cursor: 'pointer' }}
              >
                {l.icon || '🔗'}
              </button>
              {iconPicker === i && (
                <>
                  <div onClick={() => setIconPicker(null)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
                  <div className="grid" style={{ position: 'absolute', top: '38px', left: 0, zIndex: 2, background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '8px', boxShadow: '0 10px 24px rgba(0,0,0,0.16)', padding: '8px', gridTemplateColumns: 'repeat(6, 1fr)', gap: '2px', width: '232px' }}>
                    {ICON_OPTIONS.map((emoji) => (
                      <button key={emoji} type="button" onClick={() => { setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, icon: emoji } : x))); setIconPicker(null); }} className="text-lg rounded-sm" style={{ padding: '6px', border: 'none', background: l.icon === emoji ? 'var(--bg-raised)' : 'transparent', cursor: 'pointer' }}>{emoji}</button>
                    ))}
                  </div>
                </>
              )}
              <input
                value={l.label}
                onChange={(e) => setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                placeholder="Label"
                className="px-2 py-1.5 rounded-sm text-sm outline-none w-32 flex-shrink-0"
                style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
              <input
                value={l.url}
                onChange={(e) => setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))}
                placeholder="https://..."
                className="px-2 py-1.5 rounded-sm text-sm outline-none flex-1 min-w-0"
                style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
              <button onClick={() => setDraft((d) => d.filter((_, idx) => idx !== i))} className="text-xs font-spec flex-shrink-0" style={{ color: '#e40014' }}>Remove</button>
            </div>
          ))}
          <button onClick={() => setDraft((d) => [...d, { label: '', url: '', icon: '🔗' }])} className="btn-outline text-xs">+ Add link</button>
        </div>
      ) : links.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No quick links yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {links.map((l, i) => (
            <a key={i} href={normHref(l.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-sm" style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-heading)' }}>
              <span>{l.icon || '🔗'}</span>
              <span>{l.label || l.url}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

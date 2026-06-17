'use client';

import { useState } from 'react';

export default function NotesTab({ initialNotes }: { initialNotes: string }) {
  const [text, setText] = useState(initialNotes);
  const [savedText, setSavedText] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  const dirty = text !== savedText;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        setSavedText(text);
        setFlash(true);
        setTimeout(() => setFlash(false), 2000);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>A scratchpad for ideas, snippets, and reminders.</p>
        <button onClick={save} disabled={busy || !dirty} className="btn-primary text-sm">
          {busy ? 'Saving...' : flash ? 'Saved ✓' : 'Save'}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => dirty && save()}
        rows={18}
        placeholder="Type anything here..."
        className="w-full px-4 py-3 rounded-sm text-sm outline-none leading-relaxed"
        style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)', resize: 'vertical' }}
      />
    </div>
  );
}

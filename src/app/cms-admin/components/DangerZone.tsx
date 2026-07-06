'use client';

import { useState } from 'react';
import { inputClass, inputStyle } from './fields';

/** Type-the-name-to-confirm client deletion. */
export default function DangerZone({
  slug,
  name,
  onDeleted,
}: {
  slug: string;
  name: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = text.trim() === name;

  async function confirmDelete() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/clients/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) onDeleted();
      else setError(data.error ?? 'Failed to delete.');
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => { setOpen(true); setText(''); setError(''); }}
        className="btn-outline text-xs"
        style={{ color: '#e40014', borderColor: '#e40014' }}
      >
        Delete client
      </button>

      {open && (
        <div
          onClick={() => !busy && setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card p-6 w-full max-w-md">
            <h2 className="font-bold mb-1" style={{ color: 'var(--text-heading)' }}>Delete {name}?</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              This permanently removes their portal access and all portal content (updates, files, invoices, messages). This cannot be undone.
            </p>
            <label className="block text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
              Type <span style={{ color: 'var(--text-heading)' }}>{name}</span> to confirm
            </label>
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={`${inputClass} mb-4`}
              style={inputStyle}
            />
            {error && <p className="text-xs mb-3" style={{ color: '#e40014' }}>{error}</p>}
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setOpen(false)} disabled={busy} className="btn-outline text-sm">Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={!ready || busy}
                className="text-sm px-4 py-2 rounded-sm font-semibold"
                style={{
                  background: ready ? '#e40014' : 'var(--bg-raised)',
                  color: ready ? '#fff' : 'var(--text-faint)',
                  cursor: ready && !busy ? 'pointer' : 'not-allowed',
                  border: 'none',
                }}
              >
                {busy ? 'Deleting...' : 'Delete client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import type { ClientFile } from '@/lib/clients';

const CATEGORIES = ['Logos', 'Photos', 'Copywriting', 'Catalog'] as const;

/** In-house replacement for the "drop it in our shared Drive folder" link. */
export default function UploadWidget({ onUploaded }: { onUploaded: (file: ClientFile) => void }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Photos');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', category);
      const res = await fetch('/api/portal-upload', { method: 'POST', body: form });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (data.ok && data.url) {
        onUploaded({
          name: file.name,
          url: data.url,
          description: `${category} — uploaded by you`,
          date: new Date().toISOString().slice(0, 10),
        });
      } else {
        setError(data.error ?? 'Could not upload that file.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: '1px solid var(--border-accent)' }}>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Add your files</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Logos, photos, price lists, anything we should have.
        </p>
        {error && <p className="text-xs mt-1" style={{ color: '#e40014' }}>{error}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          disabled={busy}
          className="px-2 py-2 rounded-sm text-sm outline-none"
          style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-primary text-sm"
        >
          {busy ? 'Uploading...' : 'Choose file →'}
        </button>
      </div>
    </div>
  );
}

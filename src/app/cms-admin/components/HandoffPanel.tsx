'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Handoff package controls: only meaningful at the gated Handoff stage.
 * Generating rotates the assembled site's admin password and writes the
 * handover doc (credentials + checklist) to a gitignored file; Ridhi
 * reviews it here and delivers it to the client on a channel she trusts.
 */
export default function HandoffPanel({ slug, pipeline, githubUser }: { slug: string; pipeline: string; githubUser?: string }) {
  const [doc, setDoc] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [ghUser, setGhUser] = useState(githubUser ?? '');
  const [transferRepo, setTransferRepo] = useState(false);
  const [transferNote, setTransferNote] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/handoff?slug=${encodeURIComponent(slug)}`);
      const data = (await res.json()) as { ok?: boolean; exists?: boolean; doc?: string; generatedAt?: string };
      if (data.ok && data.exists) {
        setDoc(data.doc ?? '');
        setGeneratedAt(data.generatedAt ?? '');
      }
    } catch {
      /* best-effort */
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function generate() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/agents/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, githubUser: ghUser.trim() || undefined, transfer: transferRepo && !!ghUser.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; doc?: string; rotated?: boolean; error?: string; transfer?: { detail?: string } | null };
      if (data.transfer?.detail) setTransferNote(data.transfer.detail);
      if (data.ok && data.doc) {
        setDoc(data.doc);
        setGeneratedAt(new Date().toISOString());
        setShow(true);
      } else {
        setError(data.error ?? 'Could not generate the package.');
      }
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([doc], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `handover-${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Only surface once the project is at (or past) handoff, or a doc exists.
  if (pipeline !== 'handoff' && pipeline !== 'complete' && !doc) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Handoff package
        </h3>
        {generatedAt && (
          <span className="font-spec text-[10px]" style={{ color: 'var(--text-faint)' }}>
            generated {new Date(generatedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <input
          type="text"
          value={ghUser}
          onChange={(e) => setGhUser(e.target.value)}
          placeholder="client GitHub username (optional)"
          className="text-xs px-2 py-1 rounded-sm flex-1 min-w-[10rem]"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)' }}
        />
        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
          <input type="checkbox" checked={transferRepo} onChange={(e) => setTransferRepo(e.target.checked)} />
          transfer repo to them
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={generate} disabled={busy || pipeline !== 'handoff'} className="btn-primary text-xs">
          {busy ? 'Generating...' : doc ? 'Regenerate (rotates password again)' : 'Generate package (rotates admin password)'}
        </button>
        {doc && (
          <>
            <button onClick={download} className="btn-outline text-xs">Download .md</button>
            <button onClick={() => setShow((s) => !s)} className="btn-outline text-xs">{show ? 'Hide' : 'View'}</button>
          </>
        )}
      </div>

      {error && <p className="text-xs mt-2" style={{ color: '#e40014' }}>{error}</p>}
      {transferNote && <p className="text-xs mt-2" style={{ color: 'var(--accent-light)' }}>{transferNote}</p>}

      {show && doc && (
        <pre
          className="mt-3 p-3 rounded-sm text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)', maxHeight: '360px', overflowY: 'auto' }}
        >
          {doc}
        </pre>
      )}

      <p className="font-spec text-[10px] mt-3" style={{ color: 'var(--text-faint)' }}>
        Contains a live credential: the file is gitignored, and delivery to the client is yours to make on a channel you trust. Leaving Handoff stays your gate.
      </p>
    </div>
  );
}

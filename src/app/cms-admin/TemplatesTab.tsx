'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface TemplateRecord {
  name: string;
  version: string;
  kind: string;
  description: string;
  importedAt: string;
  warnings: string[];
  source: string;
}

interface Report {
  ok: boolean;
  name?: string;
  existed?: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * The studio template library: drop in a template zip an AI built against
 * the authoring rulebook, get a full validation report, and keep the ones
 * that pass. "Send to Stardrive" ports a stored template to the Stardrive
 * API (needs STARDRIVE_API_URL + STARDRIVE_API_KEY in .env.local).
 */
export default function TemplatesTab() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/templates');
      if (res.ok) setTemplates(((await res.json()) as { templates: TemplateRecord[] }).templates);
    } catch {
      /* list stays as-is */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(file: File) {
    setBusy('upload');
    setReport(null);
    setPushResult(null);
    try {
      const zipBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/agents/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', zipBase64 }),
      });
      const data = (await res.json()) as Report & { error?: string };
      setReport(data.errors || data.ok !== undefined ? data : { ok: false, errors: [data.error ?? 'Upload failed.'], warnings: [] });
      await refresh();
    } catch {
      setReport({ ok: false, errors: ['Upload failed — is the file a .zip of the template repo?'], warnings: [] });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function act(action: 'delete' | 'push-stardrive', name: string) {
    setBusy(`${action}:${name}`);
    setPushResult(null);
    try {
      const res = await fetch('/api/agents/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, name }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; stardrive?: { name?: string; warnings?: string[]; error?: { message?: string } } };
      if (action === 'push-stardrive') {
        setPushResult(
          data.ok
            ? `"${name}" is on Stardrive${data.stardrive?.warnings?.length ? ` (${data.stardrive.warnings.length} lint warning(s) carried over)` : ''}.`
            : `Stardrive rejected "${name}": ${data.stardrive?.error?.message ?? data.error ?? 'unknown error'}`
        );
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Upload a template built against the authoring rulebook (a .zip of the repo: manifest.json + files/).
          Every upload runs the full contract gate; errors reject, warnings import for your review.
        </p>
        <label className="btn-primary text-sm cursor-pointer">
          {busy === 'upload' ? 'Validating…' : 'Upload template (.zip)'}
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="hidden"
            disabled={busy !== null}
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
        </label>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Imported templates are live on Stardrive via &quot;Send to Stardrive&quot;. The Deneb4 Builder itself still
        assembles from the d4 catalog; plugging imported base templates into client builds is the recorded engine
        follow-up.
      </p>

      {report && (
        <div className="p-4 rounded-sm text-sm space-y-2" style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)' }}>
          <p style={{ color: 'var(--text-primary)' }}>
            {report.ok
              ? `✓ "${report.name}" imported${report.existed ? ' (replaced the previous version)' : ''}.`
              : '✗ Rejected — fix these and re-upload:'}
          </p>
          {report.errors.length > 0 && (
            <ul className="list-disc pl-5 space-y-1" style={{ color: '#c0392b' }}>
              {report.errors.map((e, i) => (<li key={i}>{e}</li>))}
            </ul>
          )}
          {report.warnings.length > 0 && (
            <>
              <p style={{ color: 'var(--text-muted)' }}>Warnings (imported anyway — review deliberately):</p>
              <ul className="list-disc pl-5 space-y-1" style={{ color: '#b9770e' }}>
                {report.warnings.map((w, i) => (<li key={i}>{w}</li>))}
              </ul>
            </>
          )}
        </div>
      )}

      {pushResult && (
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{pushResult}</p>
      )}

      {templates.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No templates in the library yet.</p>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.name} className="p-4 rounded-sm" style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {t.name} <span style={{ color: 'var(--text-muted)' }}>v{t.version} · {t.kind}</span>
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Imported {new Date(t.importedAt).toLocaleString()}
                    {t.warnings.length > 0 ? ` · ${t.warnings.length} lint warning(s)` : ' · clean'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => void act('push-stardrive', t.name)}
                    disabled={busy !== null}
                    className="btn-primary text-xs"
                  >
                    {busy === `push-stardrive:${t.name}` ? 'Sending…' : 'Send to Stardrive'}
                  </button>
                  <button
                    onClick={() => window.confirm(`Delete "${t.name}" from the library?`) && void act('delete', t.name)}
                    disabled={busy !== null}
                    className="text-xs px-3 py-1 rounded-sm"
                    style={{ border: '1px solid var(--border-accent)', color: 'var(--text-muted)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {t.warnings.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer" style={{ color: '#b9770e' }}>Lint warnings</summary>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-xs" style={{ color: '#b9770e' }}>
                    {t.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { ClientDraft } from './useClientDraft';

/**
 * One-click actions for a client: copy their login link, issue a new
 * password, copy the staging widget embed, jump to staging/Drive.
 */
export default function QuickActions({ slug, d }: { slug: string; d: ClientDraft }) {
  const [origin, setOrigin] = useState('');
  const [password, setPassword] = useState<{ value: string; emailed: boolean } | null>(null);
  const [emailOnReset, setEmailOnReset] = useState(true);
  const [busy, setBusy] = useState(false);
  const [widgetBusy, setWidgetBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  async function newPassword() {
    setBusy(true);
    try {
      const res = await fetch('/api/clients/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, emailClient: emailOnReset }),
      });
      const data = (await res.json()) as { password?: string; emailed?: boolean; error?: string };
      if (data.password) setPassword({ value: data.password, emailed: data.emailed === true });
      else d.setError(data.error ?? 'Failed to generate password.');
    } catch {
      d.setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
  }

  async function regenWidgetKey() {
    setWidgetBusy(true);
    try {
      const res = await fetch('/api/clients/widget-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json()) as { widgetKey?: string; error?: string };
      if (data.widgetKey) d.patch({ widgetKey: data.widgetKey });
      else d.setError(data.error ?? 'Could not generate key.');
    } catch {
      d.setError('Server error, try again.');
    } finally {
      setWidgetBusy(false);
    }
  }

  const embed = d.draft.widgetKey
    ? `<script src="${origin}/widget.js" data-deneb4-key="${d.draft.widgetKey}" defer></script>`
    : '';
  const stagingUrl = d.draft.staging.url
    ? /^https?:\/\//i.test(d.draft.staging.url) ? d.draft.staging.url : `https://${d.draft.staging.url}`
    : '';

  return (
    <div className="card p-5">
      <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
        Quick actions
      </h3>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => copy('login', `${origin}/login`)} className="btn-outline text-xs">
          {copied === 'login' ? 'Copied!' : 'Copy portal login link'}
        </button>
        <button onClick={newPassword} disabled={busy} className="btn-outline text-xs">
          {busy ? '...' : 'New password'}
        </button>
        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
          <input type="checkbox" checked={emailOnReset} onChange={(e) => setEmailOnReset(e.target.checked)} />
          email it to the client
        </label>
        {embed && (
          <button onClick={() => copy('embed', embed)} className="btn-outline text-xs">
            {copied === 'embed' ? 'Copied!' : 'Copy widget embed'}
          </button>
        )}
        {stagingUrl && (
          <a href={stagingUrl} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs">Open staging →</a>
        )}
        {d.draft.driveFolder && (
          <a href={d.draft.driveFolder} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs">Open Drive →</a>
        )}
      </div>

      {password && (
        <div className="mt-3 p-3 rounded-sm" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
          <p className="text-[10px] font-spec font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
            New password (shown once):
          </p>
          <div className="flex items-center gap-3">
            <code className="font-spec text-base tracking-widest flex-1" style={{ color: 'var(--text-heading)' }}>{password.value}</code>
            <button onClick={() => copy('pw', password.value)} className="btn-outline text-xs flex-shrink-0">{copied === 'pw' ? 'Copied!' : 'Copy'}</button>
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: password.emailed ? '#15803d' : '#b45309' }}>
            {password.emailed
              ? 'Emailed to the client. Their old password no longer works.'
              : 'No email went out (not requested or email is not configured). Share it yourself; the old password no longer works.'}
          </p>
        </div>
      )}

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-accent)' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
            Staging feedback bubble
          </span>
          <button type="button" onClick={regenWidgetKey} disabled={widgetBusy} className="text-[10px] font-spec" style={{ color: 'var(--text-faint)' }}>
            {widgetBusy ? '...' : d.draft.widgetKey ? 'Regenerate key' : 'Generate key'}
          </button>
        </div>
        {embed ? (
          <code className="block px-2 py-1.5 rounded-sm text-[11px] overflow-x-auto whitespace-nowrap" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)' }}>
            {embed}
          </code>
        ) : (
          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Generate a key to get the copy-paste embed snippet.</p>
        )}
      </div>
    </div>
  );
}

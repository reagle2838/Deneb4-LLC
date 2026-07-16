'use client';

import { useState } from 'react';

/** Self-service password change, collapsed by default so it doesn't crowd the portal. */
export default function PasswordSection() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setStatus('busy');
    try {
      const res = await fetch('/api/portal-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setStatus('done');
        setCurrentPassword('');
        setNewPassword('');
        setConfirm('');
      } else {
        setError(data.error ?? 'Could not change your password.');
        setStatus('idle');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('idle');
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs"
        style={{ color: 'var(--accent-light)' }}
      >
        Change password
      </button>
    );
  }

  return (
    <div className="card p-5 max-w-sm">
      <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
        Change password
      </h3>
      {status === 'done' ? (
        <div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-heading)' }}>Password updated.</p>
          <button onClick={() => { setOpen(false); setStatus('idle'); }} className="text-xs" style={{ color: 'var(--accent-light)' }}>
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-sm text-sm outline-none"
            style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="New password (min. 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-sm text-sm outline-none"
            style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 rounded-sm text-sm outline-none"
            style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          />
          {error && <p className="text-xs" style={{ color: '#e40014' }}>{error}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={status === 'busy'} className="btn-primary text-xs">
              {status === 'busy' ? 'Saving...' : 'Save new password'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs" style={{ color: 'var(--text-faint)' }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

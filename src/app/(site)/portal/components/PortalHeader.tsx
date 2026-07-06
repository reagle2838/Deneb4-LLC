'use client';

import { useState } from 'react';

export default function PortalHeader({ name, projectName }: { name: string; projectName: string }) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/portal-logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="font-spec text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--accent-light)' }}>
          Your Project Portal
        </p>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>
          Hello, {name.split(' ')[0]}.
        </h1>
        {projectName && (
          <p className="text-base" style={{ color: 'var(--text-muted)' }}>
            Project: <span style={{ color: 'var(--text-heading)' }}>{projectName}</span>
          </p>
        )}
      </div>
      <button onClick={logout} disabled={busy} className="btn-outline text-sm flex-shrink-0">
        {busy ? 'Signing out...' : 'Log out'}
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ClientRow {
  slug: string;
  name: string;
  email: string;
  active: boolean;
  hasPassword: boolean;
}

interface GeneratedPassword {
  clientSlug: string;
  password: string;
}

export default function ClientManagerUI({ clients }: { clients: ClientRow[] }) {
  const [generated, setGenerated] = useState<GeneratedPassword | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleGenerate(clientSlug: string) {
    setLoading(clientSlug);
    setError('');
    setGenerated(null);
    try {
      const res = await fetch('/api/generate-client-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSlug }),
      });
      const data = await res.json() as { password?: string; error?: string };
      if (data.password) {
        setGenerated({ clientSlug, password: data.password });
      } else {
        setError(data.error ?? 'Failed to generate password');
      }
    } catch {
      setError('Server error — try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      {clients.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No clients yet.</p>
          <a href="/keystatic/collections/clients/create" className="btn-primary text-sm">Create first client →</a>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <a href="/keystatic/collections/clients/create" className="btn-primary text-sm">+ New Client</a>
          </div>

          {clients.map((c) => (
            <div key={c.slug} className="card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold" style={{ color: "var(--text-heading)" }}>{c.name}</p>
                    <span className="font-spec text-[10px] tracking-widest" style={{ color: c.active ? "var(--accent-light)" : "var(--text-faint)" }}>
                      {c.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{c.email}</p>
                  <p className="text-xs mt-1 font-spec" style={{ color: "var(--text-faint)" }}>
                    {c.hasPassword ? 'Password set' : 'No password — generate one below'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <a href={`/keystatic/collections/clients/item/${c.slug}`} className="btn-outline text-xs">Edit in CMS</a>
                  <button
                    onClick={() => handleGenerate(c.slug)}
                    disabled={loading === c.slug}
                    className="btn-primary text-xs"
                  >
                    {loading === c.slug ? 'Generating...' : c.hasPassword ? 'New Password' : 'Generate Password'}
                  </button>
                </div>
              </div>

              {/* Show generated password for this client */}
              {generated?.clientSlug === c.slug && (
                <div className="mt-4 p-4 rounded-sm" style={{ background: "var(--bg-alt)", border: "1px solid var(--border-accent)" }}>
                  <p className="text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    New password — copy and send to client:
                  </p>
                  <div className="flex items-center gap-3">
                    <code className="font-spec text-lg tracking-widest flex-1" style={{ color: "var(--text-heading)" }}>
                      {generated.password}
                    </code>
                    <button
                      onClick={() => handleCopy(generated.password)}
                      className="btn-outline text-xs flex-shrink-0"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>
                    This password is shown once. Share it with {c.name} directly.
                  </p>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {error && (
        <p className="text-xs text-center" style={{ color: '#e40014' }}>{error}</p>
      )}

      <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border-accent)" }}>
        <p className="text-xs text-center font-spec" style={{ color: "var(--text-faint)" }}>
          <Link href="/keystatic" style={{ color: "var(--accent-light)" }}>← Back to CMS</Link>
          {" · "}
          <Link href="/" style={{ color: "var(--text-faint)" }}>Main site</Link>
        </p>
      </div>
    </div>
  );
}

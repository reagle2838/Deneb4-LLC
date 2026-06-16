'use client';

import { useState } from 'react';
import { StarGlyph } from '@/components/ui/Wordmark';

export default function CmsLoginPage() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/cms-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, token }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        window.location.href = '/keystatic';
      } else {
        setError(data.error ?? 'Invalid credentials');
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <StarGlyph className="w-5 h-5" />
          <span className="font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
            DENEB<span style={{ color: 'var(--accent-light)' }}>4</span>
          </span>
          <span className="font-spec text-xs ml-1" style={{ color: 'var(--text-faint)' }}>/ CMS</span>
        </div>

        <div className="card p-8">
          <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-heading)' }}>Admin Login</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Enter your password and authenticator code.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="password" className="block text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-sm text-sm outline-none"
                style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label htmlFor="token" className="block text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                Authenticator Code
              </label>
              <input
                id="token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-3 py-2.5 rounded-sm text-sm outline-none font-spec tracking-widest"
                style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: '#e40014' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary justify-center mt-1"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

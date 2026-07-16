'use client';

import Link from "next/link";
import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotBusy(true);
    setForgotMessage('');
    try {
      const res = await fetch('/api/portal-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setForgotMessage(data.message ?? data.error ?? "If that email matches a project, we've sent a new password to it.");
    } catch {
      setForgotMessage('Something went wrong. Please try again.');
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        window.location.href = '/portal';
      } else {
        setError('Invalid email or password.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-96px)] flex items-center justify-center bg-grid px-4 py-16" style={{ background: "var(--bg-base)" }}>
      <div className="w-full max-w-sm">
        <div className="card p-8">
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-heading)" }}>Client Portal</h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            {mode === 'login' ? 'Sign in to view your project updates and files.' : "Enter your email and we'll send you a new password."}
          </p>

          {mode === 'login' ? (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3 py-2.5 rounded-sm text-sm outline-none"
                    style={{ border: "1px solid var(--border-accent)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-muted)" }}>
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
                    style={{ border: "1px solid var(--border-accent)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>

                {error && (
                  <p className="text-xs" style={{ color: '#e40014' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary justify-center mt-2"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
              <p className="text-xs text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setForgotMessage(''); setForgotEmail(email); }}
                  style={{ color: "var(--accent-light)" }}
                >
                  Forgot your password?
                </button>
              </p>
            </>
          ) : (
            <form onSubmit={handleForgot} className="flex flex-col gap-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2.5 rounded-sm text-sm outline-none"
                  style={{ border: "1px solid var(--border-accent)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>

              {forgotMessage && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{forgotMessage}</p>
              )}

              <button type="submit" disabled={forgotBusy} className="btn-primary justify-center mt-2">
                {forgotBusy ? 'Sending...' : 'Send new password'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setForgotMessage(''); }}
                className="text-xs text-center"
                style={{ color: "var(--accent-light)" }}
              >
                Back to sign in
              </button>
            </form>
          )}

          <p className="text-xs text-center mt-6" style={{ color: "var(--text-faint)" }}>
            Not a client yet?{" "}
            <Link href="/start" style={{ color: "var(--accent-light)" }}>Start a project</Link>
          </p>
        </div>

        <p className="font-spec text-xs text-center mt-6" style={{ color: "var(--text-faint)" }}>
          Trouble signing in? Email{" "}
          <a href="mailto:hello@deneb4.com" style={{ color: "var(--accent-light)" }}>hello@deneb4.com</a>
        </p>
      </div>
    </section>
  );
}

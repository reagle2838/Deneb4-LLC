'use client';

import { useState } from 'react';
import type { Client } from '@/lib/clients';
import { pipelineLabel } from '@/lib/pipeline';
import { inputClass, inputStyle, labelClass, labelStyle } from './fields';

function lastActivity(c: Client): string {
  const dates = [
    ...c.feedback.map((m) => m.date),
    ...c.updates.map((u) => u.date),
    ...c.files.map((f) => f.date),
  ].filter(Boolean);
  return dates.sort().pop() ?? '';
}

function unreadCount(c: Client): number {
  return c.feedback.filter((m) => m.author === 'client' && !m.read && !m.resolved).length;
}

/** Client roster: one row per client, opening the command center. */
export default function ClientsView({
  clients,
  onOpen,
  onCreated,
}: {
  clients: Client[];
  onOpen: (slug: string) => void;
  onCreated: (client: Client, password: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', projectName: '' });
  const [password, setPassword] = useState<{ slug: string; name: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/clients/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = (await res.json()) as { slug?: string; password?: string; widgetKey?: string; error?: string };
      if (data.slug && data.password) {
        const newClient: Client = {
          slug: data.slug,
          name: addForm.name.trim(),
          email: addForm.email.trim(),
          projectName: addForm.projectName.trim(),
          active: true,
          passwordHash: 'set',
          stage: '',
          driveFolder: '',
          updates: [],
          files: [],
          revisions: [],
          invoices: [],
          staging: { url: '', username: '', password: '', status: 'building', notes: '' },
          feedbackOpen: false,
          feedback: [],
          widgetKey: data.widgetKey ?? '',
          lastSeenByClient: '',
          pipeline: 'onboarding',
        };
        onCreated(newClient, data.password);
        setPassword({ slug: data.slug, name: newClient.name, value: data.password });
        setAddForm({ name: '', email: '', projectName: '' });
        setAddOpen(false);
      } else {
        setError(data.error ?? 'Failed to create client.');
      }
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setAddOpen((v) => !v); setError(''); }} className="btn-primary text-sm">
          {addOpen ? 'Cancel' : '+ New Client'}
        </button>
      </div>

      {addOpen && (
        <form onSubmit={handleAdd} className="card p-6 space-y-4">
          <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Add a client</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Client Name *</label>
              <input className={inputClass} style={inputStyle} required value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Acme Co" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Email *</label>
              <input className={inputClass} style={inputStyle} type="email" required value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="joe@acme.com" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Project Name</label>
              <input className={inputClass} style={inputStyle} value={addForm.projectName}
                onChange={(e) => setAddForm({ ...addForm, projectName: e.target.value })} placeholder="Acme Website" />
            </div>
          </div>
          <button type="submit" disabled={busy} className="btn-primary text-sm">
            {busy ? 'Creating...' : 'Create + Generate Password'}
          </button>
        </form>
      )}

      {error && <p className="text-xs text-center" style={{ color: '#e40014' }}>{error}</p>}

      {password && (
        <div className="card p-4" style={{ borderColor: 'var(--accent-light)' }}>
          <p className="text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
            {password.name} created. Portal password (shown once):
          </p>
          <div className="flex items-center gap-3">
            <code className="font-spec text-lg tracking-widest flex-1" style={{ color: 'var(--text-heading)' }}>{password.value}</code>
            <button onClick={() => copy(password.value)} className="btn-outline text-xs flex-shrink-0">{copied ? 'Copied!' : 'Copy'}</button>
            <button onClick={() => setPassword(null)} className="text-xs font-spec" style={{ color: 'var(--text-faint)' }}>Dismiss</button>
          </div>
        </div>
      )}

      {clients.length === 0 && !addOpen && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No clients yet. Click &ldquo;New Client&rdquo; to add your first one.</p>
        </div>
      )}

      {clients.map((c) => {
        const unread = unreadCount(c);
        const last = lastActivity(c);
        return (
          <button
            key={c.slug}
            onClick={() => onOpen(c.slug)}
            className="card card-glow p-5 w-full text-left flex flex-wrap items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-0.5">
                <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>{c.name}</p>
                <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: c.active ? 'var(--accent-light)' : 'var(--text-faint)' }}>
                  {c.active ? 'Active' : 'Inactive'}
                </span>
                {unread > 0 && (
                  <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: '#e40014' }}>
                    {unread} unread
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {c.email}
                {c.projectName && <span> · {c.projectName}</span>}
              </p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <p className="font-spec text-[10px] tracking-widest uppercase" style={{ color: 'var(--accent-light)' }}>
                  {pipelineLabel(c.pipeline)}
                </p>
                <p className="font-spec text-[10px] mt-0.5 tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
                  {c.stage || 'Not started'}
                </p>
                {last && (
                  <p className="font-spec text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    Last activity {new Date(last).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
              <span className="font-spec text-xs" style={{ color: 'var(--accent-light)' }}>Open →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { Lead, LeadStage } from '@/lib/leads';

const LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'proposal', 'won', 'lost'];
const STAGE_LABEL: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
};

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LeadsTab({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [converted, setConverted] = useState<{ id: string; password: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function persist(next: Lead[]) {
    setLeads(next);
    try {
      await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: next }) });
    } catch {
      /* keep local */
    }
  }

  function setStage(id: string, stage: LeadStage) {
    persist(leads.map((l) => (l.id === id ? { ...l, stage } : l)));
  }

  function remove(id: string) {
    persist(leads.filter((l) => l.id !== id));
  }

  async function convert(lead: Lead) {
    setBusy(lead.id);
    setError('');
    try {
      const res = await fetch('/api/clients/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: lead.company || lead.name, email: lead.email, projectName: '' }),
      });
      const data = (await res.json()) as { slug?: string; password?: string; error?: string };
      if (data.password) {
        setConverted({ id: lead.id, password: data.password });
        persist(leads.map((l) => (l.id === lead.id ? { ...l, stage: 'won' } : l)));
      } else {
        setError(data.error ?? 'Could not create client.');
      }
    } catch {
      setError('Server error — try again.');
    } finally {
      setBusy(null);
    }
  }

  if (leads.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No leads yet. Contact and Start-a-Project form submissions will appear here.</p>;
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-xs" style={{ color: '#e40014' }}>{error}</p>}
      {LEAD_STAGES.map((stage) => {
        const group = leads.filter((l) => l.stage === stage);
        if (group.length === 0) return null;
        return (
          <div key={stage}>
            <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
              {STAGE_LABEL[stage]} <span style={{ color: 'var(--text-faint)' }}>· {group.length}</span>
            </h3>
            <div className="space-y-3">
              {group.map((l) => (
                <div key={l.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>{l.name}</p>
                        <span className="font-spec text-[10px] tracking-widest px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-raised)', color: 'var(--text-faint)' }}>
                          {l.source === 'start' ? 'PROJECT BRIEF' : 'INQUIRY'}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        <a href={`mailto:${l.email}`} style={{ color: 'var(--accent-light)' }}>{l.email}</a>
                        {l.company && <span> · {l.company}</span>}
                      </p>
                      {l.createdAt && <p className="text-[11px] font-spec mt-0.5" style={{ color: 'var(--text-faint)' }}>{formatDate(l.createdAt)}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={l.stage}
                        onChange={(e) => setStage(l.id, e.target.value as LeadStage)}
                        className="px-2 py-1.5 rounded-sm text-xs outline-none"
                        style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      >
                        {LEAD_STAGES.map((s) => (
                          <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                        ))}
                      </select>
                      <button onClick={() => convert(l)} disabled={busy === l.id} className="btn-outline text-xs">
                        {busy === l.id ? '...' : 'Convert to client'}
                      </button>
                      <button onClick={() => remove(l.id)} className="text-xs font-spec px-1" style={{ color: '#e40014' }}>Delete</button>
                    </div>
                  </div>

                  {l.message && (
                    <p className="text-sm mt-3 whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-muted)' }}>{l.message}</p>
                  )}

                  {converted?.id === l.id && (
                    <div className="mt-3 p-3 rounded-sm" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
                      <p className="text-xs font-spec font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Client created — portal password:</p>
                      <code className="font-spec text-base" style={{ color: 'var(--text-heading)' }}>{converted.password}</code>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Shown once. Find this client under the Clients tab.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

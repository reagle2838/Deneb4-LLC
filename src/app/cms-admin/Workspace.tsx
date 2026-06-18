'use client';

import { useState } from 'react';
import type { Client } from '@/lib/clients';
import type { Lead } from '@/lib/leads';
import type { Task } from '@/lib/tasks';
import type { QuickLink } from '@/lib/quick-links';
import ClientManagerUI from './ClientManagerUI';
import LeadsTab from './LeadsTab';
import TasksTab from './TasksTab';
import NotesTab from './NotesTab';
import QuickLinksBar from './QuickLinksBar';

type Tab = 'clients' | 'leads' | 'tasks' | 'notes';

export default function Workspace({
  clients,
  leads,
  tasks,
  notes,
  quickLinks,
}: {
  clients: Client[];
  leads: Lead[];
  tasks: Task[];
  notes: string;
  quickLinks: QuickLink[];
}) {
  const [tab, setTab] = useState<Tab>('clients');

  const newLeads = leads.filter((l) => l.stage === 'new').length;
  const openTasks = tasks.filter((t) => t.status !== 'done').length;
  const activeClients = clients.filter((c) => c.active).length;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'clients', label: 'Clients', badge: clients.length },
    { key: 'leads', label: 'Leads', badge: newLeads || undefined },
    { key: 'tasks', label: 'Tasks', badge: openTasks || undefined },
    { key: 'notes', label: 'Notes' },
  ];

  const clientList = clients.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <div>
      {/* Business overview strip */}
      <div className="flex flex-wrap items-stretch gap-3 mb-8">
        <div className="card px-5 py-4 inline-flex flex-col justify-center" style={{ minWidth: '130px' }}>
          <span className="text-3xl font-bold" style={{ color: 'var(--accent-light)' }}>{activeClients}</span>
          <span className="text-[11px] font-spec font-semibold tracking-widest uppercase mt-1" style={{ color: 'var(--text-faint)' }}>
            {activeClients === 1 ? 'Active Client' : 'Active Clients'}
          </span>
        </div>
        <QuickLinksBar initialLinks={quickLinks} />
      </div>

      <div className="flex flex-wrap gap-1 mb-8" style={{ borderBottom: '1px solid var(--border-accent)' }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-sm font-medium flex items-center gap-2"
              style={{
                color: active ? 'var(--text-heading)' : 'var(--text-muted)',
                borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                marginBottom: '-1px',
              }}
            >
              {t.label}
              {t.badge ? (
                <span className="font-spec text-[10px] px-1.5 py-0.5 rounded" style={{ background: active ? 'var(--accent)' : 'var(--bg-raised)', color: active ? '#fff' : 'var(--text-faint)' }}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === 'clients' && <ClientManagerUI initialClients={clients} />}
      {tab === 'leads' && <LeadsTab initialLeads={leads} />}
      {tab === 'tasks' && <TasksTab initialTasks={tasks} clients={clientList} />}
      {tab === 'notes' && <NotesTab initialNotes={notes} />}
    </div>
  );
}

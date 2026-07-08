'use client';

import { useState } from 'react';
import type { Client, ClientData } from '@/lib/clients';
import type { Lead } from '@/lib/leads';
import type { Task } from '@/lib/tasks';
import type { QuickLink } from '@/lib/quick-links';
import type { LedgerEntry } from '@/lib/agent-roster';
import Link from 'next/link';
import LeadsTab from './LeadsTab';
import TasksTab from './TasksTab';
import NotesTab from './NotesTab';
import QuickLinksBar from './QuickLinksBar';
import ClientsView from './components/ClientsView';
import ClientCommandCenter from './components/ClientCommandCenter';
import MessagesView from './components/MessagesView';
import AgentSpace from './components/AgentSpace';

type Tab = 'clients' | 'messages' | 'agents' | 'leads' | 'tasks' | 'notes';
const TABS: Tab[] = ['clients', 'messages', 'agents', 'leads', 'tasks', 'notes'];

/**
 * The Workspace shell. `initialTab`/`initialClient` come from the URL
 * (?tab=, ?client=) so email notifications can deep-link straight into
 * a client's command center.
 */
export default function Workspace({
  clients: initialClients,
  leads,
  tasks: initialTasks,
  notes,
  quickLinks,
  agentLedgers,
  initialTab,
  initialClient,
}: {
  clients: Client[];
  leads: Lead[];
  tasks: Task[];
  notes: string;
  quickLinks: QuickLink[];
  agentLedgers: Record<string, LedgerEntry[]>;
  initialTab?: string;
  initialClient?: string;
}) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [tab, setTabState] = useState<Tab>(() =>
    TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'clients'
  );
  const [openClient, setOpenClient] = useState<string | null>(() =>
    initialClient && initialClients.some((c) => c.slug === initialClient) ? initialClient : null
  );

  function syncUrl(nextTab: Tab, nextClient: string | null) {
    const params = new URLSearchParams();
    if (nextTab !== 'clients') params.set('tab', nextTab);
    if (nextClient) params.set('client', nextClient);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `/cms-admin?${qs}` : '/cms-admin');
  }

  function setTab(next: Tab) {
    setTabState(next);
    syncUrl(next, next === 'clients' ? openClient : null);
  }

  function openCommandCenter(slug: string) {
    setOpenClient(slug);
    setTabState('clients');
    syncUrl('clients', slug);
  }

  function closeCommandCenter() {
    setOpenClient(null);
    syncUrl('clients', null);
  }

  const newLeads = leads.filter((l) => l.stage === 'new').length;
  const openTasks = tasks.filter((t) => t.status !== 'done').length;
  const activeClients = clients.filter((c) => c.active).length;
  const unreadMessages = clients.reduce(
    (sum, c) => sum + c.feedback.filter((m) => m.author === 'client' && !m.read && !m.resolved).length,
    0
  );

  const tabs: { key: Tab; label: string; count?: number; alert?: boolean }[] = [
    { key: 'clients', label: 'Clients', count: clients.length },
    { key: 'messages', label: 'Messages', count: unreadMessages || undefined, alert: unreadMessages > 0 },
    { key: 'agents', label: 'Agents' },
    { key: 'leads', label: 'Leads', count: newLeads || undefined, alert: newLeads > 0 },
    { key: 'tasks', label: 'Tasks', count: openTasks || undefined },
    { key: 'notes', label: 'Notes' },
  ];

  const clientList = clients.map((c) => ({ slug: c.slug, name: c.name }));
  const current = openClient ? clients.find((c) => c.slug === openClient) ?? null : null;

  function handleSaved(slug: string, draft: ClientData) {
    // Mirror the server's preserve semantics: these fields have their own
    // writer paths and must not be clobbered by a (possibly stale) draft.
    setClients((prev) =>
      prev.map((c) =>
        c.slug === slug
          ? { ...c, ...draft, pipeline: c.pipeline, feedback: c.feedback, lastSeenByClient: c.lastSeenByClient }
          : c
      )
    );
  }

  function handlePipelineChange(slug: string, stage: string) {
    setClients((prev) => prev.map((c) => (c.slug === slug ? { ...c, pipeline: stage } : c)));
  }

  function handleDeleted(slug: string) {
    setClients((prev) => prev.filter((c) => c.slug !== slug));
    closeCommandCenter();
  }

  function handleCreated(client: Client) {
    setClients((prev) => [...prev, client]);
  }

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
              {t.count ? (
                <span
                  className="font-spec text-[11px]"
                  style={{ color: t.alert ? '#e40014' : active ? 'var(--accent-light)' : 'var(--text-faint)' }}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === 'clients' && (
        current ? (
          <ClientCommandCenter
            key={current.slug}
            client={current}
            tasks={tasks}
            onTasksChange={setTasks}
            onBack={closeCommandCenter}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            onPipelineChange={handlePipelineChange}
          />
        ) : (
          <ClientsView clients={clients} onOpen={openCommandCenter} onCreated={handleCreated} />
        )
      )}
      {tab === 'messages' && <MessagesView clients={clients} onOpenClient={openCommandCenter} />}
      {tab === 'agents' && <AgentSpace initialLedgers={agentLedgers} clients={clientList} />}
      {tab === 'leads' && <LeadsTab initialLeads={leads} />}
      {tab === 'tasks' && <TasksTab tasks={tasks} onChange={setTasks} clients={clientList} />}
      {tab === 'notes' && <NotesTab initialNotes={notes} />}

      <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--border-accent)' }}>
        <p className="text-xs text-center font-spec" style={{ color: 'var(--text-faint)' }}>
          <Link href="/keystatic" style={{ color: 'var(--accent-light)' }}>← Articles &amp; Work CMS</Link>
          {' · '}
          <Link href="/" style={{ color: 'var(--text-faint)' }}>Main site</Link>
        </p>
      </div>
    </div>
  );
}

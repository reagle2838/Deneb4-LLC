'use client';

import type { Client, ClientData } from '@/lib/clients';
import type { Task } from '@/lib/tasks';
import TasksTab from '../TasksTab';
import MessageThread from './MessageThread';
import QuickActions from './QuickActions';
import StagePanel from './StagePanel';
import DangerZone from './DangerZone';
import { useClientDraft } from './useClientDraft';
import {
  BasicsEditor,
  StagingEditor,
  UpdatesEditor,
  FilesEditor,
  InvoicesEditor,
  RevisionsEditor,
} from './PortalEditors';

/**
 * Everything about one client on a single screen: status and quick
 * actions on the left, the portal content editors on the right.
 */
export default function ClientCommandCenter({
  client,
  tasks,
  onTasksChange,
  onBack,
  onSaved,
  onDeleted,
}: {
  client: Client;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  onBack: () => void;
  onSaved: (slug: string, draft: ClientData) => void;
  onDeleted: (slug: string) => void;
}) {
  const d = useClientDraft(client, (draft) => onSaved(client.slug, draft));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <button onClick={onBack} className="font-spec text-xs mb-1 block" style={{ color: 'var(--accent-light)' }}>
            ← All clients
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>{client.name}</h2>
            <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: d.draft.active ? 'var(--accent-light)' : 'var(--text-faint)' }}>
              {d.draft.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {d.draft.email}
            {d.draft.projectName && <span> · {d.draft.projectName}</span>}
          </p>
        </div>
        <button onClick={d.save} disabled={d.busy} className="btn-primary text-sm flex-shrink-0">
          {d.busy ? 'Saving...' : d.savedFlash ? 'Saved ✓' : 'Save portal'}
        </button>
      </div>

      {d.error && <p className="text-xs" style={{ color: '#e40014' }}>{d.error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Left: live status + communication */}
        <div className="lg:col-span-2 space-y-5">
          <StagePanel d={d} />
          <QuickActions slug={client.slug} d={d} />

          <div className="card p-5">
            <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
              Messages
            </h3>
            <MessageThread slug={client.slug} clientName={client.name} initial={client.feedback} />
          </div>

          <div className="card p-5">
            <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
              Tasks for {client.name}
            </h3>
            <TasksTab
              tasks={tasks}
              onChange={onTasksChange}
              clients={[{ slug: client.slug, name: client.name }]}
              clientFilter={client.slug}
              compact
            />
          </div>
        </div>

        {/* Right: portal content editors */}
        <div className="lg:col-span-3 card p-6 space-y-8">
          <BasicsEditor d={d} />
          <StagingEditor d={d} />
          <UpdatesEditor d={d} />
          <FilesEditor d={d} slug={client.slug} />
          <InvoicesEditor d={d} />
          <RevisionsEditor d={d} />

          <div className="flex items-center justify-between gap-3 pt-4" style={{ borderTop: '1px solid var(--border-accent)' }}>
            <button onClick={d.save} disabled={d.busy} className="btn-primary text-sm">
              {d.busy ? 'Saving...' : d.savedFlash ? 'Saved ✓' : 'Save portal'}
            </button>
            <DangerZone slug={client.slug} name={client.name} onDeleted={() => onDeleted(client.slug)} />
          </div>
        </div>
      </div>
    </div>
  );
}

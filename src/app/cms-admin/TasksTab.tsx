'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib/tasks';

const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];
const COLUMN_LABEL: Record<TaskStatus, string> = { todo: 'To Do', doing: 'Doing', done: 'Done' };

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Task board. Controlled: the parent owns the task list so the global
 * board and per-client panels stay in sync. `clientFilter` scopes the
 * view (and new tasks) to one client; `compact` renders a simple list
 * instead of the three-column board.
 */
export default function TasksTab({
  tasks,
  onChange,
  clients,
  clientFilter,
  compact = false,
}: {
  tasks: Task[];
  onChange: (tasks: Task[]) => void;
  clients: { slug: string; name: string }[];
  clientFilter?: string;
  compact?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [client, setClient] = useState(clientFilter ?? '');

  const visible = clientFilter ? tasks.filter((t) => t.client === clientFilter) : tasks;

  function clientName(slug: string) {
    return clients.find((c) => c.slug === slug)?.name ?? '';
  }

  async function persist(next: Task[]) {
    onChange(next);
    try {
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: next }) });
    } catch {
      /* keep local state; will retry on next change */
    }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    persist([
      { id: makeId(), title: title.trim(), status: 'todo', client: clientFilter ?? client, createdAt: new Date().toISOString() },
      ...tasks,
    ]);
    setTitle('');
  }

  function advance(id: string) {
    persist(
      tasks.map((t) => {
        if (t.id !== id) return t;
        const idx = TASK_STATUSES.indexOf(t.status);
        return { ...t, status: TASK_STATUSES[(idx + 1) % TASK_STATUSES.length] };
      })
    );
  }

  function remove(id: string) {
    persist(tasks.filter((t) => t.id !== id));
  }

  function taskCard(t: Task) {
    return (
      <div key={t.id} className="p-3 rounded-sm" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
        <p className="text-sm mb-1" style={{ color: 'var(--text-heading)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</p>
        {t.client && !clientFilter && <p className="text-[11px] font-spec mb-2" style={{ color: 'var(--accent-light)' }}>{clientName(t.client)}</p>}
        <div className="flex items-center gap-3">
          {compact && (
            <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: t.status === 'done' ? '#15803d' : t.status === 'doing' ? 'var(--accent-light)' : 'var(--text-faint)' }}>
              {COLUMN_LABEL[t.status]}
            </span>
          )}
          {t.status !== 'done' && (
            <button onClick={() => advance(t.id)} className="text-[11px] font-spec" style={{ color: 'var(--accent-light)' }}>
              {t.status === 'todo' ? 'Start →' : 'Done →'}
            </button>
          )}
          {t.status === 'done' && (
            <button onClick={() => advance(t.id)} className="text-[11px] font-spec" style={{ color: 'var(--text-faint)' }}>Reopen</button>
          )}
          <button onClick={() => remove(t.id)} className="text-[11px] font-spec" style={{ color: '#e40014' }}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task..."
          className="flex-1 px-3 py-2 rounded-sm text-sm outline-none"
          style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
        />
        {!clientFilter && (
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="px-3 py-2 rounded-sm text-sm outline-none"
            style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          >
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        )}
        <button type="submit" className="btn-primary text-sm">Add task</button>
      </form>

      {compact ? (
        <div className="space-y-2">
          {visible.length === 0 && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>No tasks for this client.</p>}
          {visible.filter((t) => t.status !== 'done').map(taskCard)}
          {visible.filter((t) => t.status === 'done').map(taskCard)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TASK_STATUSES.map((status) => {
            const col = visible.filter((t) => t.status === status);
            return (
              <div key={status} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>{COLUMN_LABEL[status]}</h3>
                  <span className="font-spec text-[11px]" style={{ color: 'var(--text-faint)' }}>{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.length === 0 && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Nothing here.</p>}
                  {col.map(taskCard)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

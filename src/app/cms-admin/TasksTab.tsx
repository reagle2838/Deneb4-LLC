'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib/tasks';

const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];
const COLUMN_LABEL: Record<TaskStatus, string> = { todo: 'To Do', doing: 'Doing', done: 'Done' };

export default function TasksTab({
  initialTasks,
  clients,
}: {
  initialTasks: Task[];
  clients: { slug: string; name: string }[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');

  function clientName(slug: string) {
    return clients.find((c) => c.slug === slug)?.name ?? '';
  }

  async function persist(next: Task[]) {
    setTasks(next);
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
      { id: crypto.randomUUID(), title: title.trim(), status: 'todo', client, createdAt: new Date().toISOString() },
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

  return (
    <div>
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task..."
          className="flex-1 px-3 py-2 rounded-sm text-sm outline-none"
          style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
        />
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
        <button type="submit" className="btn-primary text-sm">Add task</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TASK_STATUSES.map((status) => {
          const col = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>{COLUMN_LABEL[status]}</h3>
                <span className="font-spec text-[11px]" style={{ color: 'var(--text-faint)' }}>{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.length === 0 && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Nothing here.</p>}
                {col.map((t) => (
                  <div key={t.id} className="p-3 rounded-sm" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
                    <p className="text-sm mb-1" style={{ color: 'var(--text-heading)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</p>
                    {t.client && <p className="text-[11px] font-spec mb-2" style={{ color: 'var(--accent-light)' }}>{clientName(t.client)}</p>}
                    <div className="flex items-center gap-3">
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
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

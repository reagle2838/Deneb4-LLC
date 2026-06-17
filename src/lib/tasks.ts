import fs from 'fs';
import path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

export type TaskStatus = 'todo' | 'doing' | 'done';
export const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  client: string; // client slug, or '' for general
  createdAt: string;
}

const FILE = path.join(process.cwd(), 'content', 'admin', 'tasks.yaml');

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function getTasks(): Task[] {
  if (!fs.existsSync(FILE)) return [];
  try {
    const data = yamlLoad(fs.readFileSync(FILE, 'utf-8')) as { tasks?: unknown } | null;
    const raw = Array.isArray(data?.tasks) ? (data!.tasks as unknown[]) : [];
    return raw.map((t) => {
      const o = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
      return {
        id: str(o.id),
        title: str(o.title),
        status: (TASK_STATUSES.includes(str(o.status) as TaskStatus) ? str(o.status) : 'todo') as TaskStatus,
        client: str(o.client),
        createdAt: str(o.createdAt),
      };
    });
  } catch {
    return [];
  }
}

export function writeTasks(tasks: Task[]): void {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, yamlDump({ tasks }, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

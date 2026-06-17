import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { writeTasks, TASK_STATUSES, type Task, type TaskStatus } from '@/lib/tasks';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { tasks?: Task[] };
    if (!Array.isArray(body.tasks)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }
    const tasks: Task[] = body.tasks.map((t) => ({
      id: String(t.id ?? ''),
      title: String(t.title ?? ''),
      status: (TASK_STATUSES.includes(t.status) ? t.status : 'todo') as TaskStatus,
      client: String(t.client ?? ''),
      createdAt: String(t.createdAt ?? ''),
    }));
    writeTasks(tasks);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

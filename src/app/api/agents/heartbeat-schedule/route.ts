import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import { verifySession } from '@/lib/cms-auth';

export const dynamic = 'force-dynamic';

/**
 * One-click local heartbeat scheduling (the button that replaces "run this
 * PowerShell command"). Wraps scripts/register-heartbeat-task.ps1, which
 * registers a per-user Windows Scheduled Task (no admin elevation needed)
 * firing scripts/heartbeat-trigger.mjs on an interval against THIS app's
 * origin. CMS-session only: registering a scheduled task is a machine
 * change, so it stays behind Ridhi's own login — agents can't call it.
 *
 * Windows-only by design: in production the heartbeat comes from Vercel
 * Cron (vercel.json + the tick route's CRON_SECRET branch) with no machine
 * setup at all.
 */

const TASK_NAME = 'Deneb4 Agent Heartbeat';

function ps(args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args],
      { timeout: 30_000, windowsHide: true },
      (err, stdout, stderr) => {
        resolve({ code: err ? 1 : 0, out: `${stdout}\n${stderr}`.trim() });
      }
    );
  });
}

export async function GET(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.platform !== 'win32') {
    return NextResponse.json({ supported: false, scheduled: false, detail: 'Local scheduling is Windows-only; production uses Vercel Cron.' });
  }
  const { out } = await ps([
    '-Command',
    `if (Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue) { 'REGISTERED' } else { 'NOT-REGISTERED' }`,
  ]);
  return NextResponse.json({ supported: true, scheduled: out.includes('REGISTERED') && !out.includes('NOT-REGISTERED') });
}

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.platform !== 'win32') {
    return NextResponse.json({ error: 'Local scheduling is Windows-only; production uses Vercel Cron.' }, { status: 501 });
  }

  let body: { action?: 'register' | 'remove'; intervalMinutes?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const script = path.join(process.cwd(), 'scripts', 'register-heartbeat-task.ps1');
  if (body.action === 'remove') {
    const { code, out } = await ps(['-File', script, '-Remove']);
    return code === 0
      ? NextResponse.json({ ok: true, detail: out })
      : NextResponse.json({ error: out || 'Could not remove the task.' }, { status: 500 });
  }

  const interval = Math.min(Math.max(Math.round(body.intervalMinutes ?? 30), 15), 120);
  const { code, out } = await ps([
    '-File', script,
    '-IntervalMinutes', String(interval),
    '-Url', req.nextUrl.origin,
  ]);
  return code === 0
    ? NextResponse.json({ ok: true, detail: out })
    : NextResponse.json({ error: out || 'Could not register the task.' }, { status: 500 });
}

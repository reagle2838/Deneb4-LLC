import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { fetchUpcomingEvents, formatEventLine } from '@/lib/calendar';
import { sendEmail } from '@/lib/email';
import { getAllClients, countUnreadForOwner, countPendingDrafts } from '@/lib/clients';
import { appendLedger, STUDIO_CHANNEL } from '@/lib/agent-ledger';
import { recordRun, getRecentRuns } from '@/lib/agent-runs';
import { getState, setState, ownerToday } from '@/lib/agent-state';
import { getPipelineStage } from '@/lib/pipeline';
import { notifyOwnerOfAgentAlert } from '@/lib/notify';
import type { DutyResult } from '@/lib/agent-roster';

export const dynamic = 'force-dynamic';

/**
 * The agent heartbeat (ROADMAP Phase 5: scheduling/triggers + error
 * handling). An external scheduler (Hostinger cron, Task Scheduler, or a
 * cloud agent) POSTs here on an interval. It runs each sensing duty in
 * isolation, so one failing duty never sinks the others, records the run
 * to the run log for observability, and escalates any duty error to
 * Ridhi. GET returns recent run history.
 *
 * Auth: CMS session cookie or x-agent-key header.
 */
async function authorized(req: NextRequest): Promise<boolean> {
  if (await verifySession(req.cookies.get('cms_auth')?.value)) return true;
  const key = process.env.AGENT_API_KEY;
  return Boolean(key && req.headers.get('x-agent-key') === key);
}

const OWNER_TZ = process.env.OWNER_TIMEZONE || 'America/New_York';

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, runs: getRecentRuns(20) });
}

/**
 * Concierge duty: once per day, if there are upcoming appointments, email
 * Ridhi a digest. Deduped by date so a frequent cron doesn't re-send.
 */
async function calendarDuty(): Promise<DutyResult> {
  const icsUrl = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!icsUrl) {
    return { name: 'calendar', status: 'skipped', summary: 'GOOGLE_CALENDAR_ICS_URL not set.' };
  }
  const today = ownerToday(OWNER_TZ);
  if (getState('lastCalendarDigestDate') === today) {
    return { name: 'calendar', status: 'skipped', summary: 'Already sent today\'s digest.' };
  }
  const events = await fetchUpcomingEvents(icsUrl, 48);
  if (events.length === 0) {
    setState('lastCalendarDigestDate', today);
    return { name: 'calendar', status: 'ok', summary: 'No appointments in the next 48h.' };
  }
  const lines = events.map((e) => formatEventLine(e, OWNER_TZ));
  const to = process.env.CONTACT_TO_EMAIL || 'hello@deneb4.com';
  const listHtml = lines
    .map((l) => `<li style="margin:6px 0;color:#18222e;font-size:14px;line-height:1.6;">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`)
    .join('');
  const result = await sendEmail({
    to,
    subject: events.length === 1 ? `1 appointment coming up: ${events[0].summary}` : `${events.length} appointments in the next 48 hours`,
    html: `
  <div style="background:#f2f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,107,143,0.18);border-top:3px solid #006b8f;border-radius:4px;padding:28px;">
      <p style="margin:0 0 14px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#1f93ba;">Concierge · Daily calendar</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.35;color:#080f1a;">Upcoming appointments</h1>
      <ul style="margin:0;padding-left:18px;">${listHtml}</ul>
      <p style="margin:24px 0 0;font-size:11px;color:#7d8d9b;">Deneb4 · Concierge agent</p>
    </div>
  </div>`,
  });
  appendLedger(STUDIO_CHANNEL, {
    agent: 'concierge',
    kind: 'event',
    message: `Daily calendar: ${events.length} upcoming appointment${events.length === 1 ? '' : 's'}.\n${lines.join('\n')}`,
    data: { count: String(events.length), emailed: String(result.delivered) },
  });
  setState('lastCalendarDigestDate', today);
  return { name: 'calendar', status: 'ok', summary: `Digest sent for ${events.length} appointment(s).` };
}

/**
 * Concierge/Comms duty: once per day, scan every client for things that
 * need Ridhi: unread client messages and projects parked at a gated
 * pipeline stage. Posts a worklist digest to the Studio ledger.
 */
async function worklistDuty(): Promise<DutyResult> {
  const today = ownerToday(OWNER_TZ);
  if (getState('lastWorklistDate') === today) {
    return { name: 'worklist', status: 'skipped', summary: 'Worklist already posted today.' };
  }
  const clients = await getAllClients();
  const unread = clients
    .map((c) => ({ name: c.name, n: countUnreadForOwner(c) }))
    .filter((x) => x.n > 0);
  const gated = clients
    .filter((c) => c.active && getPipelineStage(c.pipeline)?.gated)
    .map((c) => ({ name: c.name, stage: getPipelineStage(c.pipeline)?.label ?? c.pipeline }));
  const drafts = clients
    .map((c) => ({ name: c.name, n: countPendingDrafts(c) }))
    .filter((x) => x.n > 0);

  if (unread.length === 0 && gated.length === 0 && drafts.length === 0) {
    setState('lastWorklistDate', today);
    return { name: 'worklist', status: 'ok', summary: 'Nothing needs Ridhi today.' };
  }

  const parts: string[] = [];
  if (unread.length) parts.push(`Unread client messages: ${unread.map((u) => `${u.name} (${u.n})`).join(', ')}.`);
  if (drafts.length) parts.push(`Draft replies awaiting your approval: ${drafts.map((d) => `${d.name} (${d.n})`).join(', ')}.`);
  if (gated.length) parts.push(`Waiting on your gate: ${gated.map((g) => `${g.name} at ${g.stage}`).join(', ')}.`);

  appendLedger(STUDIO_CHANNEL, {
    agent: 'concierge',
    kind: 'event',
    message: `Daily worklist.\n${parts.join('\n')}`,
    data: { unread: String(unread.length), drafts: String(drafts.length), gated: String(gated.length) },
  });
  setState('lastWorklistDate', today);
  return { name: 'worklist', status: 'ok', summary: `${unread.length} unread, ${drafts.length} draft(s), ${gated.length} at a gate.` };
}

// Integrations that need external credentials Ridhi hasn't provided yet.
// Listed explicitly so the run log shows they were considered, not forgotten.
function stubbedDuties(): DutyResult[] {
  return [
    { name: 'form-received', status: 'skipped', summary: 'Needs Google Drive API (Provisioning part 2).' },
    { name: 'payment-received', status: 'skipped', summary: 'Needs Wave integration (Billing).' },
  ];
}

async function runDuty(fn: () => Promise<DutyResult>, name: string): Promise<DutyResult> {
  try {
    return await fn();
  } catch (err) {
    const summary = err instanceof Error ? err.message : 'Unknown error.';
    console.error(`[deneb4] tick duty ${name} failed:`, err);
    return { name, status: 'error', summary };
  }
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const started = Date.now();
  const trigger = (req.nextUrl.searchParams.get('trigger') || 'cron').slice(0, 40);

  const duties: DutyResult[] = [
    await runDuty(calendarDuty, 'calendar'),
    await runDuty(worklistDuty, 'worklist'),
    ...stubbedDuties(),
  ];

  const run = recordRun({ trigger, durationMs: Date.now() - started, duties });

  // Escalate any hard failures (never throws; digest of failed duties).
  const failed = duties.filter((d) => d.status === 'error');
  if (failed.length > 0) {
    await notifyOwnerOfAgentAlert(
      STUDIO_CHANNEL,
      'system',
      `Agent heartbeat had ${failed.length} failing dut${failed.length === 1 ? 'y' : 'ies'}:\n` +
        failed.map((d) => `- ${d.name}: ${d.summary}`).join('\n')
    );
  }

  return NextResponse.json({ ok: true, run });
}

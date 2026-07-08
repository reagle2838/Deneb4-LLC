import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { fetchUpcomingEvents, formatEventLine } from '@/lib/calendar';
import { sendEmail } from '@/lib/email';
import { appendLedger, STUDIO_CHANNEL } from '@/lib/agent-ledger';

export const dynamic = 'force-dynamic';

/**
 * Concierge duty #1: check Ridhi's Google Calendar and alert her to
 * upcoming appointments (ROADMAP Phase 6).
 *
 * GET  = preview: returns the events in the window, no side effects.
 * POST = the daily run: if events are found, email Ridhi a digest and
 *        record it on the Studio ledger channel. Silent when empty.
 *
 * Auth: CMS session cookie or x-agent-key header (same as the ledger).
 * Trigger cadence is the scheduler's job; this endpoint doesn't dedupe.
 */
async function authorized(req: NextRequest): Promise<boolean> {
  if (await verifySession(req.cookies.get('cms_auth')?.value)) return true;
  const key = process.env.AGENT_API_KEY;
  return Boolean(key && req.headers.get('x-agent-key') === key);
}

const OWNER_TZ = process.env.OWNER_TIMEZONE || 'America/New_York';

function windowHours(req: NextRequest): number {
  const raw = Number(req.nextUrl.searchParams.get('hours'));
  return Number.isFinite(raw) && raw >= 1 && raw <= 24 * 14 ? raw : 48;
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const icsUrl = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!icsUrl) {
    return NextResponse.json(
      { error: 'GOOGLE_CALENDAR_ICS_URL is not set. Paste the calendar\'s "secret address in iCal format" into .env.local.' },
      { status: 503 }
    );
  }
  try {
    const hours = windowHours(req);
    const events = await fetchUpcomingEvents(icsUrl, hours);
    return NextResponse.json({
      ok: true,
      hours,
      count: events.length,
      events: events.map((e) => ({ summary: e.summary, when: formatEventLine(e, OWNER_TZ), location: e.location })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Calendar fetch failed.' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const icsUrl = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!icsUrl) {
    return NextResponse.json(
      { error: 'GOOGLE_CALENDAR_ICS_URL is not set. Paste the calendar\'s "secret address in iCal format" into .env.local.' },
      { status: 503 }
    );
  }

  try {
    const hours = windowHours(req);
    const events = await fetchUpcomingEvents(icsUrl, hours);

    if (events.length === 0) {
      return NextResponse.json({ ok: true, count: 0, notified: false });
    }

    const lines = events.map((e) => formatEventLine(e, OWNER_TZ));
    const to = process.env.CONTACT_TO_EMAIL || 'hello@deneb4.com';

    let delivered = false;
    try {
      const listHtml = lines
        .map((l) => `<li style="margin:6px 0;color:#18222e;font-size:14px;line-height:1.6;">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`)
        .join('');
      const result = await sendEmail({
        to,
        subject: events.length === 1 ? `1 appointment coming up: ${events[0].summary}` : `${events.length} appointments in the next ${hours} hours`,
        html: `
  <div style="background:#f2f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,107,143,0.18);border-top:3px solid #006b8f;border-radius:4px;padding:28px;">
      <p style="margin:0 0 14px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#1f93ba;">Concierge · Calendar check</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.35;color:#080f1a;">Upcoming appointments</h1>
      <ul style="margin:0;padding-left:18px;">${listHtml}</ul>
      <p style="margin:24px 0 0;font-size:11px;color:#7d8d9b;">Deneb4 · Concierge agent</p>
    </div>
  </div>`,
      });
      delivered = result.delivered;
    } catch (err) {
      console.error('[deneb4] calendar digest email failed:', err);
    }

    appendLedger(STUDIO_CHANNEL, {
      agent: 'concierge',
      kind: 'event',
      message: `Calendar check: ${events.length} upcoming appointment${events.length === 1 ? '' : 's'} in the next ${hours} hours.\n${lines.join('\n')}`,
      data: { count: String(events.length), emailed: String(delivered) },
    });

    return NextResponse.json({ ok: true, count: events.length, notified: true, delivered, events: lines });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Calendar fetch failed.' }, { status: 502 });
  }
}

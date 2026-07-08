import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import {
  getLedger,
  getAllLedgers,
  appendLedger,
  isValidChannel,
  LEDGER_KINDS,
  type LedgerKind,
} from '@/lib/agent-ledger';
import { notifyOwnerOfAgentAlert } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * The agents' shared communication API.
 * Auth: Ridhi's CMS session cookie, OR the x-agent-key header matching
 * AGENT_API_KEY (how headless agents will authenticate; if the env var
 * is unset, header auth is disabled and only the cookie works).
 */
async function authorized(req: NextRequest): Promise<boolean> {
  if (await verifySession(req.cookies.get('cms_auth')?.value)) return true;
  const key = process.env.AGENT_API_KEY;
  return Boolean(key && req.headers.get('x-agent-key') === key);
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const channel = req.nextUrl.searchParams.get('channel');
  if (channel) {
    if (!isValidChannel(channel)) {
      return NextResponse.json({ error: 'Invalid channel.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, channel, entries: getLedger(channel) });
  }
  return NextResponse.json({ ok: true, channels: getAllLedgers() });
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as {
      channel?: string;
      agent?: string;
      kind?: string;
      message?: string;
      data?: Record<string, string>;
    };
    const channel = (body.channel ?? '').trim();
    const agent = (body.agent ?? '').trim();
    const message = (body.message ?? '').trim();
    const kind = (body.kind ?? 'event').trim() as LedgerKind;

    if (!isValidChannel(channel)) {
      return NextResponse.json({ error: 'Invalid channel.' }, { status: 400 });
    }
    if (!agent || !message) {
      return NextResponse.json({ error: 'Agent and message are required.' }, { status: 400 });
    }
    if (!LEDGER_KINDS.includes(kind)) {
      return NextResponse.json({ error: `Kind must be one of: ${LEDGER_KINDS.join(', ')}.` }, { status: 400 });
    }

    const entry = appendLedger(channel, {
      agent,
      kind,
      message: message.slice(0, 8000),
      data: body.data,
    });
    if (!entry) {
      return NextResponse.json({ error: 'Could not write to ledger.' }, { status: 500 });
    }

    // Escalation rule (docs/agents.md): an alert means the agent stopped
    // and is waiting on Ridhi, so it goes straight to her inbox. Ridhi's
    // own posts don't email herself.
    if (kind === 'alert' && agent !== 'ridhi') {
      await notifyOwnerOfAgentAlert(channel, agent, entry.message);
    }

    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

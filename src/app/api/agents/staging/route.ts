import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug, setStaging, type ClientStaging } from '@/lib/clients';
import { appendLedger } from '@/lib/agent-ledger';

export const dynamic = 'force-dynamic';

/**
 * Deploy writeback: the deploy script (or a future host integration)
 * records where a client's staging build actually lives. Only url/status/
 * notes are writable here — staging credentials stay Ridhi's to set in the
 * Workspace. Every change lands on the client's ledger channel.
 */

const STATUSES: ClientStaging['status'][] = ['building', 'ready', 'live', 'down'];

async function authorized(req: NextRequest): Promise<boolean> {
  if (await verifySession(req.cookies.get('cms_auth')?.value)) return true;
  const key = process.env.AGENT_API_KEY;
  return Boolean(key && req.headers.get('x-agent-key') === key);
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { slug?: string; url?: string; status?: string; notes?: string; agent?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const client = body.slug ? await getClientBySlug(body.slug) : null;
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  const patch: Partial<ClientStaging> = {};
  if (typeof body.url === 'string') patch.url = body.url.trim().slice(0, 300);
  if (body.status && STATUSES.includes(body.status as ClientStaging['status'])) {
    patch.status = body.status as ClientStaging['status'];
  }
  if (typeof body.notes === 'string') patch.notes = body.notes.slice(0, 500);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update (url/status/notes).' }, { status: 400 });
  }

  const staging = setStaging(body.slug!, patch);
  appendLedger(body.slug!, {
    agent: body.agent || 'builder',
    kind: 'event',
    message: `Staging updated: ${staging?.url || '(no url)'} — status ${staging?.status}.${patch.notes ? ` ${patch.notes}` : ''}`,
    data: { url: staging?.url ?? '', status: staging?.status ?? '' },
  });
  return NextResponse.json({ ok: true, staging });
}

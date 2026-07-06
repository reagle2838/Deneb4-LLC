import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getClientByWidgetKey,
  addFeedback,
  editFeedback,
  deleteFeedback,
  type ClientFeedback,
} from '@/lib/clients';
import { notifyOwnerOfClientMessage } from '@/lib/notify';

export const dynamic = 'force-dynamic';

// The widget runs on the client's staging site (a different origin), so every
// response needs permissive CORS. Auth is the per-client key in the body/query,
// never a cookie, so a wildcard origin is safe (no credentials are sent).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

/** Public-facing shape — strips internal fields like `read`. */
function publicThread(thread: ClientFeedback[]) {
  return thread.map((m) => ({
    id: m.id,
    author: m.author,
    message: m.message,
    page: m.page,
    date: m.date,
    resolved: m.resolved,
  }));
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') ?? '';
  const client = await getClientByWidgetKey(key);
  if (!client || !client.active) return json({ error: 'Invalid key' }, 404);
  return json({
    ok: true,
    canComment: client.feedbackOpen,
    projectName: client.projectName || client.name,
    thread: publicThread(client.feedback),
  });
}

export async function POST(req: NextRequest) {
  let body: { key?: string; action?: string; id?: string; message?: string; page?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const client = await getClientByWidgetKey(body.key ?? '');
  if (!client || !client.active) return json({ error: 'Invalid key' }, 404);
  if (!client.feedbackOpen) return json({ error: 'Commenting is closed for this project.' }, 403);

  const slug = client.slug;

  if (body.action === 'edit') {
    const message = (body.message ?? '').trim();
    if (!body.id || !message) return json({ error: 'Missing fields' }, 400);
    const ok = editFeedback(slug, body.id, message, 'client');
    return ok ? json({ ok: true }) : json({ error: 'Could not edit' }, 400);
  }

  if (body.action === 'delete') {
    if (!body.id) return json({ error: 'Missing id' }, 400);
    const ok = deleteFeedback(slug, body.id, 'client');
    return ok ? json({ ok: true }) : json({ error: 'Could not delete' }, 400);
  }

  // Default: new comment
  const message = (body.message ?? '').trim();
  if (!message) return json({ error: 'Message is required.' }, 400);
  const entry: ClientFeedback = {
    id: crypto.randomUUID(),
    author: 'client',
    message: message.slice(0, 4000),
    page: (body.page ?? '').trim().slice(0, 200),
    date: new Date().toISOString(),
    read: false,
    resolved: false,
  };
  const ok = addFeedback(slug, entry);
  if (ok) await notifyOwnerOfClientMessage(client, entry, 'widget');
  return ok
    ? json({ ok: true, entry: publicThread([entry])[0] })
    : json({ error: 'Could not save.' }, 500);
}

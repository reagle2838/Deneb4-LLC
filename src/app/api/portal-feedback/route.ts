import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyPortalSession } from '@/lib/portal-auth';
import {
  addFeedback,
  editFeedback,
  deleteFeedback,
  markThreadSeenByClient,
  getClientBySlug,
  type ClientFeedback,
} from '@/lib/clients';
import { notifyOwnerOfClientMessage } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const clientSlug = await verifyPortalSession(req.cookies.get('portal_session')?.value);
  if (!clientSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { action?: 'edit' | 'delete' | 'seen'; id?: string; message?: string; page?: string };

    // The client opened/scrolled to the thread: record it for unread tracking.
    if (body.action === 'seen') {
      markThreadSeenByClient(clientSlug);
      return NextResponse.json({ ok: true });
    }

    // Clients may only edit/delete their own (author: 'client') messages.
    if (body.action === 'edit') {
      const message = (body.message ?? '').trim();
      if (!body.id || !message) return NextResponse.json({ error: 'Missing id or message.' }, { status: 400 });
      if (!editFeedback(clientSlug, body.id, message, 'client')) {
        return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
      if (!deleteFeedback(clientSlug, body.id, 'client')) {
        return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    // Default: new message
    const message = (body.message ?? '').trim();
    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }
    const entry: ClientFeedback = {
      id: crypto.randomUUID(),
      author: 'client',
      message,
      page: (body.page ?? '').trim(),
      date: new Date().toISOString(),
      read: false,
      resolved: false,
    };
    if (!addFeedback(clientSlug, entry)) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }
    const client = await getClientBySlug(clientSlug);
    if (client) await notifyOwnerOfClientMessage(client, entry, 'portal');
    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

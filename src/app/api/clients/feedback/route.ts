import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifySession } from '@/lib/cms-auth';
import { addFeedback, markFeedbackRead, editFeedback, deleteFeedback, resolveFeedback, getClientBySlug, type ClientFeedback } from '@/lib/clients';
import { notifyClientOfReply } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { slug?: string; action?: 'reply' | 'markRead' | 'edit' | 'delete' | 'resolve'; id?: string; message?: string };
    const slug = body.slug;
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug.' }, { status: 400 });
    }

    if (body.action === 'markRead') {
      if (!markFeedbackRead(slug)) {
        return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'resolve') {
      if (!resolveFeedback(slug)) {
        return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    // Deneb4 may only edit/delete its own (author: 'deneb4') messages.
    if (body.action === 'edit') {
      const message = (body.message ?? '').trim();
      if (!body.id || !message) return NextResponse.json({ error: 'Missing id or message.' }, { status: 400 });
      if (!editFeedback(slug, body.id, message, 'deneb4')) {
        return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
      if (!deleteFeedback(slug, body.id, 'deneb4')) {
        return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    // Default: reply
    const message = (body.message ?? '').trim();
    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }
    const entry: ClientFeedback = {
      id: crypto.randomUUID(),
      author: 'deneb4',
      message,
      page: '',
      date: new Date().toISOString(),
      read: true,
      resolved: false,
    };
    // Posting a reply also marks the client's messages as read.
    markFeedbackRead(slug);
    if (!addFeedback(slug, entry)) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }
    const client = await getClientBySlug(slug);
    if (client) await notifyClientOfReply(client, entry);
    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

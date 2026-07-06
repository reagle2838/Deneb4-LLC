import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyPortalSession } from '@/lib/portal-auth';
import { approveUpdate, addFeedback, type ClientFeedback } from '@/lib/clients';
import { notifyOwnerOfApproval } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * Client approves a phase that is waiting for sign-off. Flips the update
 * to complete, drops an automatic note into the message thread, and
 * emails the studio.
 */
export async function POST(req: NextRequest) {
  const clientSlug = await verifyPortalSession(req.cookies.get('portal_session')?.value);
  if (!clientSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { index?: number; phase?: string };
    if (typeof body.index !== 'number' || !body.phase) {
      return NextResponse.json({ error: 'Missing index or phase.' }, { status: 400 });
    }

    const client = approveUpdate(clientSlug, body.index, body.phase);
    if (!client) {
      return NextResponse.json(
        { error: 'This item is no longer waiting for approval.' },
        { status: 409 }
      );
    }

    // Leave a record in the thread so both sides see the approval in context.
    const note: ClientFeedback = {
      id: crypto.randomUUID(),
      author: 'client',
      message: `Approved: ${body.phase}`,
      page: '',
      date: new Date().toISOString(),
      read: false,
      resolved: false,
    };
    addFeedback(clientSlug, note);

    await notifyOwnerOfApproval(client, body.phase);

    return NextResponse.json({ ok: true, updates: client.updates });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyPortalSession } from '@/lib/portal-auth';
import { approveUpdate, addFeedback, type ClientFeedback } from '@/lib/clients';
import { notifyOwnerOfApproval } from '@/lib/notify';
import { recordClientSignoff } from '@/lib/signoff';
import { QUOTE_PHASE } from '@/lib/quotes';
import { confirmQuoteAndKickoff } from '@/lib/quote-flow';

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
    const body = (await req.json()) as { index?: number; phase?: string; signatureName?: string };
    if (typeof body.index !== 'number' || !body.phase) {
      return NextResponse.json({ error: 'Missing index or phase.' }, { status: 400 });
    }
    if (body.phase === QUOTE_PHASE && !(body.signatureName ?? '').trim()) {
      return NextResponse.json({ error: 'Type your full name to sign the scope agreement.' }, { status: 400 });
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

    // The quote-approval item (Phase 14, gate #1): the client's Approve
    // confirms the quote, signs the scope agreement (typed name), applies
    // the confirmed scope as the build config, and drafts the deposit
    // invoice. The build starts when it's paid.
    if (body.phase === QUOTE_PHASE) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
      await confirmQuoteAndKickoff(clientSlug, { typedName: (body.signatureName ?? '').trim(), ip });
    }

    // If this was the final-approval item, record the sign-off: the gate
    // criterion is the client's own action, so this also advances the
    // pipeline to payment and drafts the final invoice for Ridhi's
    // send-approval.
    await recordClientSignoff(client, body.phase);

    await notifyOwnerOfApproval(client, body.phase);

    return NextResponse.json({ ok: true, updates: client.updates });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

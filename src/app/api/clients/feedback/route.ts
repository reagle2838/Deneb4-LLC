import { NextRequest, NextResponse } from 'next/server';
import { hasAgentKey } from '@/lib/agent-auth';
import crypto from 'crypto';
import { verifySession } from '@/lib/cms-auth';
import {
  addFeedback,
  markFeedbackRead,
  editFeedback,
  deleteFeedback,
  resolveFeedback,
  getClientBySlug,
  addDraftReply,
  editDraftReply,
  deleteDraftReply,
  approveDraftReply,
  type ClientFeedback,
} from '@/lib/clients';
import { notifyClientOfReply } from '@/lib/notify';

export const dynamic = 'force-dynamic';

type Action =
  | 'reply'
  | 'markRead'
  | 'edit'
  | 'delete'
  | 'resolve'
  | 'draft'
  | 'draftEdit'
  | 'draftDelete'
  | 'draftApprove';

// Only proposing a draft is open to headless agents (via x-agent-key).
// Everything else, including approving a draft (which sends to the client),
// requires Ridhi's CMS session. This enforces "agents propose, Ridhi
// disposes" from docs/agents.md.
const AGENT_ALLOWED: Action[] = ['draft'];

async function hasCmsSession(req: NextRequest): Promise<boolean> {
  return verifySession(req.cookies.get('cms_auth')?.value);
}

export async function POST(req: NextRequest) {
  let body: { slug?: string; action?: Action; id?: string; message?: string; page?: string; agent?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const action: Action = body.action ?? 'reply';
  const cms = await hasCmsSession(req);
  const authorized = cms || (AGENT_ALLOWED.includes(action) && hasAgentKey(req));
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const slug = body.slug;
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug.' }, { status: 400 });
    }

    // ── Draft replies (the copy-review gate) ──────────────────────────
    if (action === 'draft') {
      const message = (body.message ?? '').trim();
      if (!message) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
      const draft = addDraftReply(slug, {
        message,
        page: body.page,
        // Agents identify via `agent`; Ridhi's own drafts are attributed to her.
        createdBy: cms && !body.agent ? 'ridhi' : body.agent || 'comms',
      });
      if (!draft) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
      return NextResponse.json({ ok: true, draft });
    }

    if (action === 'draftEdit') {
      const message = (body.message ?? '').trim();
      if (!body.id || !message) return NextResponse.json({ error: 'Missing id or message.' }, { status: 400 });
      if (!editDraftReply(slug, body.id, message)) {
        return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'draftDelete') {
      if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
      if (!deleteDraftReply(slug, body.id)) {
        return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'draftApprove') {
      if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
      const result = approveDraftReply(slug, body.id);
      if (!result) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
      await notifyClientOfReply(result.client, result.entry);
      return NextResponse.json({ ok: true, entry: result.entry });
    }

    // ── Existing owner actions ────────────────────────────────────────
    if (action === 'markRead') {
      if (!markFeedbackRead(slug)) {
        return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'resolve') {
      if (!resolveFeedback(slug)) {
        return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    // Deneb4 may only edit/delete its own (author: 'deneb4') messages.
    if (action === 'edit') {
      const message = (body.message ?? '').trim();
      if (!body.id || !message) return NextResponse.json({ error: 'Missing id or message.' }, { status: 400 });
      if (!editFeedback(slug, body.id, message, 'deneb4')) {
        return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }
    if (action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
      if (!deleteFeedback(slug, body.id, 'deneb4')) {
        return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    // Default: reply (sends immediately)
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

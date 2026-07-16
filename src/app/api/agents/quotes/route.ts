import { NextRequest, NextResponse } from 'next/server';
import { hasAgentKey, isValidSlug } from '@/lib/agent-auth';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug } from '@/lib/clients';
import { draftQuote, getQuoteRecord, ridhiDenyQuote } from '@/lib/quotes';
import { approveQuoteAndNotify } from '@/lib/quote-flow';
import { appendLedger } from '@/lib/agent-ledger';

export const dynamic = 'force-dynamic';

/**
 * The quote gate (Phase 14, HITL touchpoint #1). Agents may DRAFT a quote
 * (x-agent-key); only Ridhi's CMS session may APPROVE (sends it to the
 * client for confirmation) or DENY — and a denial carries instructions the
 * agent accommodates before re-proposing. The client's confirmation comes
 * through the portal Approve item or the GAS quote_signed webhook, never
 * through this route.
 */

async function hasCmsSession(req: NextRequest): Promise<boolean> {
  return verifySession(req.cookies.get('cms_auth')?.value);
}

export async function GET(req: NextRequest) {
  if (!(await hasCmsSession(req)) && !hasAgentKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'Missing or invalid slug.' }, { status: 400 });
  return NextResponse.json({ ok: true, quote: getQuoteRecord(slug) });
}

export async function POST(req: NextRequest) {
  let body: { slug?: string; action?: 'draft' | 'approve' | 'deny'; instructions?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const action = body.action ?? 'draft';
  const cms = await hasCmsSession(req);
  const authorized = cms || (action === 'draft' && hasAgentKey(req));
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = body.slug ?? '';
  const client = isValidSlug(slug) ? await getClientBySlug(slug) : null;
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  if (action === 'draft') {
    const record = draftQuote(slug, cms ? 'ridhi' : 'agent');
    if (!record) {
      return NextResponse.json(
        { error: 'No config to price — this client has neither a staged intake config nor an applied build config.' },
        { status: 400 }
      );
    }
    appendLedger(slug, {
      agent: 'billing',
      kind: 'event',
      message: `Quote drafted and awaiting your approval on the client's Quote panel.`,
    });
    return NextResponse.json({ ok: true, quote: record });
  }

  if (action === 'approve') {
    const result = await approveQuoteAndNotify(slug);
    if (!result.ok) return NextResponse.json({ error: result.detail }, { status: 409 });
    return NextResponse.json({ ok: true, quote: getQuoteRecord(slug), detail: result.detail });
  }

  // deny — instructions required: a denial without direction is a dead end,
  // and the whole point of this gate is the feedback loop.
  const instructions = (body.instructions ?? '').trim();
  if (!instructions) {
    return NextResponse.json(
      { error: 'Tell the agent what to change (e.g. "remove the blog", "$200 off") — instructions are required on a deny.' },
      { status: 400 }
    );
  }
  const record = await ridhiDenyQuote(slug, instructions);
  if (!record) return NextResponse.json({ error: 'No quote awaiting your approval.' }, { status: 409 });
  return NextResponse.json({ ok: true, quote: record });
}

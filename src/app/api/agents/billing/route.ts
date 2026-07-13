import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug } from '@/lib/clients';
import { getProposedInvoices, approveSendInvoice, rejectInvoice, proposeDeposit, proposeFinal } from '@/lib/billing';
import { computeQuote, computeAnthropicCost, loadPricing } from '@/lib/pricing';
import { getCosts, recordCost, type CostKind } from '@/lib/costs';
import { getConsultations, logConsultation } from '@/lib/consultations';

export const dynamic = 'force-dynamic';

/**
 * Billing surface. GET returns the live quote (with cost floor + margin),
 * proposed/sent invoices, and the cost ledger. POST actions:
 *   approve-send / reject  — CMS only (Ridhi's send gate)
 *   propose-deposit / propose-final — agent key or CMS (idempotence is the
 *     caller's concern; drafts are cheap and visible)
 *   record-cost — agent key or CMS (e.g. a consultation call happened)
 */

async function hasCmsSession(req: NextRequest): Promise<boolean> {
  return verifySession(req.cookies.get('cms_auth')?.value);
}
function hasAgentKey(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY;
  return Boolean(key && req.headers.get('x-agent-key') === key);
}

export async function GET(req: NextRequest) {
  if (!(await hasCmsSession(req)) && !hasAgentKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  if (!slug) return NextResponse.json({ error: 'Missing slug.' }, { status: 400 });
  return NextResponse.json({
    ok: true,
    quote: computeQuote(slug),
    proposed: getProposedInvoices(slug),
    costs: getCosts(slug),
    consultations: getConsultations(slug),
  });
}

const COST_KINDS: CostKind[] = ['build-api', 'resend', 'elevenlabs-call', 'other'];

export async function POST(req: NextRequest) {
  let body: {
    slug?: string;
    action?: 'approve-send' | 'reject' | 'propose-deposit' | 'propose-final' | 'record-cost' | 'record-api-usage' | 'log-consultation';
    id?: string;
    note?: string;
    kind?: string;
    amount?: number;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    durationMin?: number;
    summary?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const action = body.action;
  const cms = await hasCmsSession(req);
  const agent = hasAgentKey(req);
  const cmsOnlyActions = ['approve-send', 'reject'];
  const authorized = cms || (agent && action != null && !cmsOnlyActions.includes(action));
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = body.slug ? await getClientBySlug(body.slug) : null;
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  if (action === 'approve-send') {
    if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
    const sent = await approveSendInvoice(client.slug, body.id);
    if (!sent) return NextResponse.json({ error: 'Pending invoice draft not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, invoice: sent });
  }

  if (action === 'reject') {
    if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
    const rejected = rejectInvoice(client.slug, body.id, body.note);
    if (!rejected) return NextResponse.json({ error: 'Pending invoice draft not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, invoice: rejected });
  }

  if (action === 'propose-deposit' || action === 'propose-final') {
    const proposal = action === 'propose-deposit' ? await proposeDeposit(client) : await proposeFinal(client);
    if (!proposal) return NextResponse.json({ error: 'No build config to quote from yet.' }, { status: 400 });
    return NextResponse.json({ ok: true, invoice: proposal });
  }

  if (action === 'record-api-usage') {
    if (!body.model || typeof body.inputTokens !== 'number' || typeof body.outputTokens !== 'number') {
      return NextResponse.json({ error: 'model, inputTokens, outputTokens are required.' }, { status: 400 });
    }
    const amount = computeAnthropicCost(body.model, body.inputTokens, body.outputTokens);
    if (amount <= 0) return NextResponse.json({ ok: true, skipped: true });
    const entry = recordCost(client.slug, {
      kind: 'build-api',
      amount,
      note: `${body.note ?? 'API usage'} (${body.model}): ${body.inputTokens} in / ${body.outputTokens} out tokens.`,
    });
    return NextResponse.json({ ok: true, cost: entry });
  }

  if (action === 'log-consultation') {
    const summary = (body.summary ?? '').trim();
    if (!summary) {
      return NextResponse.json({ error: 'A consultation log needs a summary of what was discussed.' }, { status: 400 });
    }
    const record = logConsultation(client.slug, { durationMin: body.durationMin, summary });
    if (!record) return NextResponse.json({ error: 'Could not log the consultation.' }, { status: 400 });
    return NextResponse.json({ ok: true, consultation: record });
  }

  if (action === 'record-cost') {
    const kind = COST_KINDS.includes(body.kind as CostKind) ? (body.kind as CostKind) : null;
    if (!kind) return NextResponse.json({ error: `kind must be one of ${COST_KINDS.join(', ')}.` }, { status: 400 });
    // A consultation without an explicit amount books at the configured cost.
    const amount = typeof body.amount === 'number' ? body.amount : kind === 'elevenlabs-call' ? loadPricing().consultationCost : NaN;
    const entry = recordCost(client.slug, { kind, amount, note: body.note });
    if (!entry) return NextResponse.json({ error: 'Invalid amount.' }, { status: 400 });
    return NextResponse.json({ ok: true, cost: entry });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

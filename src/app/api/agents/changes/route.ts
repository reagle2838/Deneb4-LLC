import { NextRequest, NextResponse } from 'next/server';
import { hasAgentKey, isValidSlug } from '@/lib/agent-auth';
import path from 'path';
import { spawn } from 'child_process';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug } from '@/lib/clients';
import { appendLedger } from '@/lib/agent-ledger';
import {
  getProposals,
  addProposal,
  resolveProposal,
  sanitizePatch,
  patchIsEmpty,
  applyPatchToBuildConfig,
  hasBuildConfig,
} from '@/lib/comms';

export const dynamic = 'force-dynamic';

/**
 * Change proposals: the structured change-lists Comms hands the Builder,
 * behind Ridhi's gate (docs/agents.md). Agents may PROPOSE (x-agent-key);
 * only Ridhi's CMS session may APPROVE or REJECT. Approving applies the
 * patch to the client's build config — the single source of truth the
 * Builder's change loop consumes — and, when BUILDER_AUTORUN=true, kicks
 * off the Builder in the background (it reports its own result to the
 * ledger and auto-reverts if QA rejects the change).
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
  return NextResponse.json({ ok: true, proposals: getProposals(slug) });
}

export async function POST(req: NextRequest) {
  let body: {
    slug?: string;
    action?: 'propose' | 'approve' | 'reject';
    id?: string;
    patch?: unknown;
    summary?: string;
    note?: string;
    agent?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const action = body.action ?? 'propose';
  const cms = await hasCmsSession(req);
  // Agents propose; only Ridhi disposes.
  const authorized = cms || (action === 'propose' && hasAgentKey(req));
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = body.slug ?? '';
  const client = slug ? await getClientBySlug(slug) : null;
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  if (action === 'propose') {
    const { patch, dropped } = sanitizePatch(body.patch);
    if (patchIsEmpty(patch)) {
      return NextResponse.json(
        { error: `Nothing on the closed menu in that patch.${dropped.length ? ` Dropped: ${dropped.join('; ')}.` : ''}` },
        { status: 400 }
      );
    }
    if (!hasBuildConfig(slug)) {
      return NextResponse.json({ error: 'This client has no build config yet.' }, { status: 400 });
    }
    const proposal = addProposal(slug, {
      patch,
      summary: (body.summary ?? '').slice(0, 300) || undefined,
      createdBy: cms && !body.agent ? 'ridhi' : body.agent || 'comms',
    });
    return NextResponse.json({ ok: true, proposal, dropped });
  }

  if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

  if (action === 'reject') {
    const proposal = resolveProposal(slug, body.id, 'rejected', (body.note ?? '').slice(0, 300) || undefined);
    if (!proposal) return NextResponse.json({ error: 'Pending proposal not found.' }, { status: 404 });
    appendLedger(slug, {
      agent: 'ridhi',
      kind: 'decision',
      message: `Rejected proposed change: ${proposal.summary}.${proposal.note ? ` Note: ${proposal.note}` : ''}`,
    });
    return NextResponse.json({ ok: true, proposal });
  }

  // approve: apply the patch to the build config, then hand off to the Builder.
  const pending = getProposals(slug).find((p) => p.id === body.id && p.status === 'proposed');
  if (!pending) return NextResponse.json({ error: 'Pending proposal not found.' }, { status: 404 });
  const applied = applyPatchToBuildConfig(slug, pending.patch);
  if (applied === null) {
    return NextResponse.json({ error: 'This client has no build config to apply the change to.' }, { status: 400 });
  }

  let builderNote: string;
  const builderStages = ['building', 'client-review'];
  if (!builderStages.includes(client.pipeline)) {
    // The Builder refuses to act outside its stages (and silently, when
    // spawned detached) — say so instead of launching a doomed run.
    builderNote = `Config updated, but the pipeline is at "${client.pipeline || 'not set'}" and the Builder only applies changes during building/client-review. It will pick this change up on the next eligible run.`;
  } else if (process.env.BUILDER_AUTORUN === 'true') {
    // Fire-and-forget: the Builder reports green/red to the ledger itself
    // and auto-reverts a change QA rejects.
    const child = spawn(
      process.execPath,
      [path.join(process.cwd(), 'scripts', 'build-client.mjs'), slug, '--report-to', req.nextUrl.origin],
      { cwd: process.cwd(), detached: true, stdio: 'ignore', env: { ...process.env, NODE_OPTIONS: '--use-system-ca' } }
    );
    child.unref();
    builderNote = 'Builder started in the background; its result will appear on this channel.';
  } else {
    builderNote = `Config updated. Run: npm run builder -- ${slug} --report-to <origin>`;
  }

  resolveProposal(slug, body.id, 'applied', builderNote);
  appendLedger(slug, {
    agent: 'ridhi',
    kind: 'decision',
    message: `Approved proposed change: ${pending.summary}. Build config updated (${applied}). ${builderNote}`,
  });
  return NextResponse.json({ ok: true, proposal: pending, builder: builderNote });
}

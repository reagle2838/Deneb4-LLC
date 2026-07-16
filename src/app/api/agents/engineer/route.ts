import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { hasAgentKey, isValidSlug } from '@/lib/agent-auth';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug } from '@/lib/clients';
import { appendLedger } from '@/lib/agent-ledger';
import {
  buildDir,
  createWorkOrder,
  deleteEngineerBranch,
  getWorkOrders,
  mergeEngineerBranch,
  pushMain,
  updateWorkOrder,
  type WorkOrderStatus,
} from '@/lib/engineer';

export const dynamic = 'force-dynamic';

/**
 * The Engineer's API (docs/agents.md, 2026-07-16). Work orders are
 * RIDHI-ONLY to create/approve/reject — the whole point of the role is
 * that off-catalog work never starts from a client message or an agent's
 * own initiative. The runner reports progress with the agent key.
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
  return NextResponse.json({ ok: true, orders: getWorkOrders(slug) });
}

export async function POST(req: NextRequest) {
  let body: {
    slug?: string;
    action?: 'create' | 'update' | 'approve' | 'reject';
    id?: string;
    spec?: string;
    note?: string;
    status?: WorkOrderStatus;
    summary?: string;
    diffstat?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const action = body.action ?? 'create';
  const cms = await hasCmsSession(req);
  // The runner may only 'update'; every human decision is CMS-only.
  const authorized = cms || (action === 'update' && hasAgentKey(req));
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = body.slug ?? '';
  const client = isValidSlug(slug) ? await getClientBySlug(slug) : null;
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  if (action === 'create') {
    const spec = (body.spec ?? '').trim();
    if (spec.length < 10) {
      return NextResponse.json({ error: 'Write a real work order — what should change, where, and any constraints.' }, { status: 400 });
    }
    if (!fs.existsSync(path.join(buildDir(slug), '.git'))) {
      return NextResponse.json({ error: `builds/${slug} is not a git repo yet — the Engineer works on built sites.` }, { status: 400 });
    }
    const order = createWorkOrder(slug, spec);
    const args = [
      path.join(process.cwd(), 'scripts', 'engineer.mjs'),
      slug,
      order.id,
      '--report-to',
      req.nextUrl.origin,
    ];
    if (process.env.ENGINEER_ENGINE === 'dry') args.push('--engine', 'dry');
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, NODE_OPTIONS: '--use-system-ca' },
    });
    child.unref();
    appendLedger(slug, {
      agent: 'engineer',
      kind: 'event',
      message: `Work order ${order.id} accepted: "${order.spec.slice(0, 140)}". Working on branch ${order.branch}; QA runs before you see it.`,
    });
    return NextResponse.json({ ok: true, order });
  }

  if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  const order = getWorkOrders(slug).find((o) => o.id === body.id);
  if (!order) return NextResponse.json({ error: 'Work order not found.' }, { status: 404 });

  if (action === 'update') {
    const updated = updateWorkOrder(slug, body.id, {
      ...(body.status ? { status: body.status } : {}),
      ...(body.summary !== undefined ? { summary: String(body.summary).slice(0, 2000) } : {}),
      ...(body.diffstat !== undefined ? { diffstat: String(body.diffstat).slice(0, 2000) } : {}),
      ...(body.note !== undefined ? { note: String(body.note).slice(0, 1000) } : {}),
    });
    return NextResponse.json({ ok: true, order: updated });
  }

  if (action === 'approve') {
    if (order.status !== 'review') {
      return NextResponse.json({ error: `Order is ${order.status}, not awaiting review.` }, { status: 409 });
    }
    const merged = mergeEngineerBranch(slug, order.branch);
    if (!merged.ok) return NextResponse.json({ error: merged.detail }, { status: 500 });
    const push = pushMain(slug);
    updateWorkOrder(slug, order.id, { status: 'applied', note: `Merged as ${merged.sha}. ${push.detail}` });
    appendLedger(slug, {
      agent: 'ridhi',
      kind: 'decision',
      message: `Approved Engineer work order ${order.id} ("${order.spec.slice(0, 100)}"). Merged to main (${merged.sha}). ${push.detail}`,
    });
    let deployNote = '';
    if (process.env.AUTO_DEPLOY_STAGING === 'true') {
      const dep = spawn(process.execPath, [path.join(process.cwd(), 'scripts', 'deploy-staging.mjs'), slug], {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, NODE_OPTIONS: '--use-system-ca' },
      });
      dep.unref();
      deployNote = ' Staging redeploy started.';
    }
    return NextResponse.json({ ok: true, sha: merged.sha, detail: `${push.detail}${deployNote}` });
  }

  // reject
  if (order.status !== 'review' && order.status !== 'failed') {
    return NextResponse.json({ error: `Order is ${order.status}; only review/failed orders can be rejected.` }, { status: 409 });
  }
  deleteEngineerBranch(slug, order.branch);
  updateWorkOrder(slug, order.id, { status: 'rejected', note: (body.note ?? '').slice(0, 500) || undefined });
  appendLedger(slug, {
    agent: 'ridhi',
    kind: 'decision',
    message: `Rejected Engineer work order ${order.id}.${body.note ? ` Note: ${body.note.slice(0, 200)}` : ''} Branch deleted.`,
  });
  return NextResponse.json({ ok: true });
}

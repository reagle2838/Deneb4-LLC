import { NextRequest, NextResponse } from 'next/server';
import { hasAgentKey } from '@/lib/agent-auth';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug, setPipelineStage } from '@/lib/clients';
import { appendLedger } from '@/lib/agent-ledger';
import { PIPELINE_STAGES, isPipelineStage, pipelineLabel, getPipelineStage } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

/**
 * The pipeline state machine's single writer (ROADMAP Phase 5).
 * Every stage change lands on the client's agent-ledger channel as a
 * handoff entry, so the Agents tab is a complete transition history.
 *
 * GET  ?client=slug  -> current stage + the full stage catalog
 * POST { client, stage, agent?, note? } -> move the client; idempotent
 *
 * Auth: CMS session cookie or x-agent-key header (same as the ledger).
 */
async function authorized(req: NextRequest): Promise<boolean> {
  if (await verifySession(req.cookies.get('cms_auth')?.value)) return true;
  return hasAgentKey(req);
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get('client');
  if (!slug) {
    return NextResponse.json({ ok: true, stages: PIPELINE_STAGES });
  }
  const client = await getClientBySlug(slug);
  if (!client) {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    client: slug,
    stage: client.pipeline,
    label: pipelineLabel(client.pipeline),
    gated: getPipelineStage(client.pipeline)?.gated ?? false,
    stages: PIPELINE_STAGES,
  });
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { client?: string; stage?: string; agent?: string; note?: string };
    const slug = (body.client ?? '').trim();
    const stage = (body.stage ?? '').trim();
    const agent = (body.agent ?? 'ridhi').trim() || 'ridhi';
    const note = (body.note ?? '').trim();

    if (!slug) {
      return NextResponse.json({ error: 'Missing client.' }, { status: 400 });
    }
    if (!isPipelineStage(stage)) {
      return NextResponse.json(
        { error: `Unknown stage. Must be one of: ${PIPELINE_STAGES.map((s) => s.id).join(', ')}.` },
        { status: 400 }
      );
    }

    const result = setPipelineStage(slug, stage);
    if (!result) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    // Idempotent repeat: no transition, no ledger noise.
    if (result.from === result.to) {
      return NextResponse.json({ ok: true, changed: false, stage: result.to });
    }

    appendLedger(slug, {
      agent,
      kind: 'handoff',
      message: `Pipeline stage: ${pipelineLabel(result.from)} → ${pipelineLabel(result.to)}${note ? `. ${note}` : ''}`,
      data: { from: result.from || '(unset)', to: result.to },
    });

    return NextResponse.json({ ok: true, changed: true, from: result.from, stage: result.to });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

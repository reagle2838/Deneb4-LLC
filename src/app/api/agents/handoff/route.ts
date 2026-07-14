import { NextRequest, NextResponse } from 'next/server';
import { isValidSlug } from '@/lib/agent-auth';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug, setGithubUser } from '@/lib/clients';
import { generateHandoffPackage, getHandoffDoc } from '@/lib/handoff';
import { transferRepoToClient } from '@/lib/github-transfer';
import { appendLedger } from '@/lib/agent-ledger';

export const dynamic = 'force-dynamic';

/**
 * Handoff package generation. CMS-only in BOTH directions — the package
 * contains a live credential, so not even the agent key may read it.
 * Generating requires the client to actually be at the handoff stage:
 * that stage is gated and only Ridhi moves clients into it, which makes
 * the pipeline itself the authorization to rotate credentials.
 */

async function cmsOnly(req: NextRequest): Promise<boolean> {
  return verifySession(req.cookies.get('cms_auth')?.value);
}

export async function GET(req: NextRequest) {
  if (!(await cmsOnly(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'Missing or invalid slug.' }, { status: 400 });
  const existing = getHandoffDoc(slug);
  return NextResponse.json({ ok: true, exists: Boolean(existing), ...existing });
}

export async function POST(req: NextRequest) {
  if (!(await cmsOnly(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { slug?: string; githubUser?: string; transfer?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const client = body.slug ? await getClientBySlug(body.slug) : null;
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
  if (client.pipeline !== 'handoff') {
    return NextResponse.json(
      { error: `Handoff packages are generated at the Handoff stage (this client is at "${client.pipeline || 'not set'}"). Move the pipeline first — that gate is the authorization to rotate credentials.` },
      { status: 409 }
    );
  }

  // Persist a GitHub username passed with the request (collected at handoff).
  if (typeof body.githubUser === 'string' && body.githubUser.trim()) {
    setGithubUser(client.slug, body.githubUser);
    client.githubUser = body.githubUser.trim().replace(/^@/, '');
  }

  const { doc, rotated } = generateHandoffPackage(client);

  // Optionally hand the repo to the client's GitHub account (dormant without
  // the token). Off by default; the panel opts in explicitly.
  let transfer = null;
  if (body.transfer) {
    transfer = await transferRepoToClient(client.slug, client.githubUser);
    appendLedger(client.slug, {
      agent: 'concierge',
      kind: transfer.transferred ? 'handoff' : 'event',
      message: `Repo transfer: ${transfer.detail}`,
    });
  }

  return NextResponse.json({ ok: true, doc, rotated, transfer });
}

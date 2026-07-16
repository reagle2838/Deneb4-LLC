import { NextRequest, NextResponse } from 'next/server';
import { handleIntakeSubmitted } from '@/lib/intake-webhook';

export const dynamic = 'force-dynamic';

/**
 * Deneb4's own intake form (replacing the Google Form as the primary
 * path — see /intake). First-party: the form lives on our own domain, so
 * this route needs no agent-key auth, only basic shape validation and a
 * light rate/size guard. Payload keys are the same Q-codes the parser in
 * intake-webhook.ts already understands (Q3-1, Q7A-1, ...), so this reuses
 * 100% of the existing staging/quote-drafting logic — no second mapping to
 * maintain. The Google Form path (handleIntakeSubmitted via
 * /api/agents/intake-webhook) keeps working unchanged for any client who
 * still comes in that way.
 */
export async function POST(req: NextRequest) {
  let body: { responses?: Record<string, string>; driveFolderUrl?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  if (!body.responses || typeof body.responses !== 'object') {
    return NextResponse.json({ error: 'Missing responses.' }, { status: 400 });
  }
  // Cap total payload size defensively — this is a public, unauthenticated route.
  const size = JSON.stringify(body.responses).length;
  if (size > 50_000) {
    return NextResponse.json({ error: 'Submission too large.' }, { status: 413 });
  }

  try {
    const result = await handleIntakeSubmitted({
      responses: body.responses,
      driveFolderUrl: body.driveFolderUrl,
      siteUrl: req.nextUrl.origin,
    });
    // Never return the password to the browser — it's already emailed.
    return NextResponse.json({ ok: true, created: result.created, credentialsEmailed: result.credentialsEmailed });
  } catch (err) {
    console.error('[deneb4] intake submission failed:', err);
    return NextResponse.json({ error: 'Something went wrong submitting your project. Please email hello@deneb4.com.' }, { status: 500 });
  }
}

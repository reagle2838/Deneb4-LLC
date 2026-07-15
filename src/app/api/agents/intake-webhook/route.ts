import { NextRequest, NextResponse } from 'next/server';
import { hasAgentKey } from '@/lib/agent-auth';
import {
  handleIntakeSubmitted,
  handleOnboardingSigned,
  handleHandoffSent,
  handleHandoffSigned,
} from '@/lib/intake-webhook';

export const dynamic = 'force-dynamic';

/**
 * Receiving end of the bridge from Ridhi's Google Workspace automation
 * (Apps Script, triggered off her Forms) into the Deneb4 pipeline. Her
 * spreadsheet + e-signed documents remain the actual approval mechanism —
 * this endpoint only RECORDS milestones so the Workspace's granular
 * pipeline stage stays in sync with her four real events, without
 * bypassing any existing human gate:
 *
 *   intake_submitted   → creates the client (if new) + stages a PROPOSED
 *                        build config for Ridhi's review (never applied
 *                        automatically — the fact-slot rule + start-
 *                        approval gate both still hold)
 *   onboarding_signed  → advances pipeline to intake-review + alerts Ridhi
 *                        it's ready for her to review/apply/build
 *   handoff_sent       → advances pipeline to approval (Ridhi's own
 *                        Handoff Document automation is the actual ask;
 *                        this just mirrors the stage)
 *   handoff_signed     → calls the SAME recordClientSignoff() the portal's
 *                        own Approve button uses, so approval→payment and
 *                        the final invoice draft happen exactly as they
 *                        already do today
 *
 * Auth: x-agent-key (same header/secret Apps Script's UrlFetchApp sends).
 */

interface Body {
  event?: 'intake_submitted' | 'onboarding_signed' | 'handoff_sent' | 'handoff_signed';
  responses?: Record<string, string[] | string>;
  driveFolderUrl?: string;
  siteUrl?: string;
  email?: string;
  slug?: string;
}

export async function POST(req: NextRequest) {
  if (!hasAgentKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    switch (body.event) {
      case 'intake_submitted': {
        if (!body.responses) return NextResponse.json({ error: 'responses is required.' }, { status: 400 });
        const result = await handleIntakeSubmitted({
          responses: body.responses,
          driveFolderUrl: body.driveFolderUrl,
          siteUrl: body.siteUrl || req.nextUrl.origin,
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'onboarding_signed': {
        if (!body.email) return NextResponse.json({ error: 'email is required.' }, { status: 400 });
        const result = await handleOnboardingSigned(body.email);
        if (!result) return NextResponse.json({ error: 'No client matches that email.' }, { status: 404 });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'handoff_sent': {
        const result = await handleHandoffSent({ email: body.email, slug: body.slug });
        if (!result) return NextResponse.json({ error: 'No matching client.' }, { status: 404 });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'handoff_signed': {
        if (!body.email) return NextResponse.json({ error: 'email is required.' }, { status: 400 });
        const result = await handleHandoffSigned(body.email);
        if (!result) return NextResponse.json({ error: 'No client matches that email.' }, { status: 404 });
        return NextResponse.json({ ok: true, ...result });
      }
      default:
        return NextResponse.json({ error: 'event must be one of: intake_submitted, onboarding_signed, handoff_sent, handoff_signed.' }, { status: 400 });
    }
  } catch (err) {
    console.error('[deneb4] intake-webhook failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}

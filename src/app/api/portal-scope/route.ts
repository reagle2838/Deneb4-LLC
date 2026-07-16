import { NextRequest, NextResponse } from 'next/server';
import { verifyPortalSession } from '@/lib/portal-auth';
import { getScopeDocument } from '@/lib/scope';

export const dynamic = 'force-dynamic';

/**
 * Authenticated download of the client's own signed scope agreement — the
 * in-house replacement for the GAS-locked scope PDF. Served only behind
 * the portal session, same pattern as /api/portal-handoff.
 */
export async function GET(req: NextRequest) {
  const clientSlug = await verifyPortalSession(req.cookies.get('portal_session')?.value);
  if (!clientSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = getScopeDocument(clientSlug);
  if (!doc) return NextResponse.json({ error: 'No scope agreement found.' }, { status: 404 });

  const footer = doc.signature
    ? `\n\n---\nSigned by: ${doc.signature.typedName}\nSigned at: ${doc.signature.signedAt}\n(This document is locked and cannot be edited after signing.)`
    : '\n\n---\n(Not yet signed.)';

  return new NextResponse(doc.content + footer, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="scope-agreement-${clientSlug}-v${doc.version}.md"`,
      'Cache-Control': 'no-store',
    },
  });
}

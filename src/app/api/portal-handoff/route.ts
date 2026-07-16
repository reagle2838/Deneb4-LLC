import { NextRequest, NextResponse } from 'next/server';
import { verifyPortalSession } from '@/lib/portal-auth';
import { getHandoffDoc } from '@/lib/handoff';

export const dynamic = 'force-dynamic';

/**
 * Authenticated download of the client's own handoff package (Phase 14
 * agentic delivery). The doc carries a live admin credential, so it is
 * served ONLY behind the portal session — never emailed, never linked
 * publicly. Each client can only ever reach their own document: the slug
 * comes from the session, not the request.
 */
export async function GET(req: NextRequest) {
  const clientSlug = await verifyPortalSession(req.cookies.get('portal_session')?.value);
  if (!clientSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const pkg = getHandoffDoc(clientSlug);
  if (!pkg) {
    return NextResponse.json({ error: 'Your handoff package is not ready yet.' }, { status: 404 });
  }
  return new NextResponse(pkg.doc, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="handoff-package-${clientSlug}.md"`,
      'Cache-Control': 'no-store',
    },
  });
}

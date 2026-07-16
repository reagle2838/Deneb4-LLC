import { NextRequest, NextResponse } from 'next/server';
import { verifyPortalSession } from '@/lib/portal-auth';
import { verifySession } from '@/lib/cms-auth';

export const dynamic = 'force-dynamic';

/**
 * Authenticated proxy for private Vercel Blob client uploads (Logos /
 * Photos / Copywriting / Catalog — the in-house Drive-folder equivalent).
 * The store is private by design: these can be unreleased branding or
 * price lists, not public assets. A bare blob URL isn't fetchable without
 * a token, so every read goes through here — either the OWNING client's
 * own portal session, or Ridhi's CMS session (she needs these to build
 * the site). The path itself is scoped-checked: a client can only ever
 * reach client-uploads/<their-own-slug>/..., never another client's.
 */
export async function GET(req: NextRequest) {
  const pathname = req.nextUrl.searchParams.get('path') ?? '';
  const match = pathname.match(/^client-uploads\/([a-z0-9][a-z0-9-]{0,63})\//);
  if (!match) return NextResponse.json({ error: 'Invalid path.' }, { status: 400 });
  const owningSlug = match[1];

  const portalSlug = await verifyPortalSession(req.cookies.get('portal_session')?.value);
  const cms = await verifySession(req.cookies.get('cms_auth')?.value);
  if (!cms && portalSlug !== owningSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { get } = await import('@vercel/blob');
    const result = await get(pathname, { access: 'private' });
    if (!result) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    return new NextResponse(result.stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': result.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[deneb4] portal-file proxy failed:', e);
    return NextResponse.json({ error: 'Could not retrieve the file.' }, { status: 500 });
  }
}

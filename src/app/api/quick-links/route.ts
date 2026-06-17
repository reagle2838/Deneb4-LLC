import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { writeQuickLinks, type QuickLink } from '@/lib/quick-links';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { links?: QuickLink[] };
    if (!Array.isArray(body.links)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }
    const links = body.links.map((l) => ({ label: String(l.label ?? ''), url: String(l.url ?? ''), icon: String(l.icon ?? '🔗') }));
    writeQuickLinks(links);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

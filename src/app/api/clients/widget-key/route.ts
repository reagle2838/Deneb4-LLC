import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { setWidgetKey } from '@/lib/clients';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { slug?: string };
    const slug = body.slug;
    if (!slug) return NextResponse.json({ error: 'Missing slug.' }, { status: 400 });

    const widgetKey = setWidgetKey(slug);
    if (!widgetKey) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

    return NextResponse.json({ widgetKey });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

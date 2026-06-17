import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug, writeClient, type ClientData } from '@/lib/clients';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { slug?: string; data?: ClientData };
    const { slug, data } = body;
    if (!slug || !data) {
      return NextResponse.json({ error: 'Missing slug or data.' }, { status: 400 });
    }

    const existing = await getClientBySlug(slug);
    if (!existing) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    // Name + passwordHash are not editable here; preserve them.
    writeClient(slug, {
      passwordHash: existing.passwordHash,
      data: {
        name: existing.name,
        email: data.email ?? existing.email,
        projectName: data.projectName ?? existing.projectName,
        active: data.active ?? existing.active,
        updates: data.updates ?? [],
        files: data.files ?? [],
        revisions: data.revisions ?? [],
        invoices: data.invoices ?? [],
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

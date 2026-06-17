import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { slugify, clientExists, writeClient, EMPTY_STAGING } from '@/lib/clients';
import { generateClientPassword, hashPassword } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { name?: string; email?: string; projectName?: string };
    const name = (body.name ?? '').trim();
    const email = (body.email ?? '').trim();
    const projectName = (body.projectName ?? '').trim();

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    const slug = slugify(name);
    if (!slug) {
      return NextResponse.json({ error: 'Name must contain letters or numbers.' }, { status: 400 });
    }
    if (clientExists(slug)) {
      return NextResponse.json({ error: 'A client with this name already exists.' }, { status: 409 });
    }

    const password = generateClientPassword();
    const passwordHash = hashPassword(password);

    writeClient(slug, {
      passwordHash,
      data: {
        name,
        email,
        projectName,
        active: true,
        stage: '',
        driveFolder: '',
        updates: [],
        files: [],
        revisions: [],
        invoices: [],
        staging: EMPTY_STAGING,
      },
    });

    return NextResponse.json({ slug, password });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

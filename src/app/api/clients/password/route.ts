import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug, writeClient } from '@/lib/clients';
import { generateClientPassword, hashPassword } from '@/lib/portal-auth';
import { notifyClientCredentials } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { slug?: string; emailClient?: boolean };
    const slug = body.slug;
    const emailClient = body.emailClient === true;
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug.' }, { status: 400 });
    }

    const existing = await getClientBySlug(slug);
    if (!existing) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    const password = generateClientPassword();
    writeClient(slug, {
      passwordHash: hashPassword(password),
      data: {
        name: existing.name,
        email: existing.email,
        projectName: existing.projectName,
        active: existing.active,
        stage: existing.stage,
        driveFolder: existing.driveFolder,
        updates: existing.updates,
        files: existing.files,
        revisions: existing.revisions,
        invoices: existing.invoices,
        staging: existing.staging,
        feedbackOpen: existing.feedbackOpen,
        feedback: existing.feedback,
        widgetKey: existing.widgetKey,
        lastSeenByClient: existing.lastSeenByClient,
        pipeline: existing.pipeline,
        draftReplies: existing.draftReplies,
      },
    });

    let emailed = false;
    if (emailClient) {
      emailed = await notifyClientCredentials(existing, password, 'reset');
    }

    return NextResponse.json({ password, emailed });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

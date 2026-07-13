import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug, writeClient, generateWidgetKey, type ClientData } from '@/lib/clients';

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
        phone: data.phone ?? existing.phone,
        internalNotes: data.internalNotes ?? existing.internalNotes,
        projectName: data.projectName ?? existing.projectName,
        active: data.active ?? existing.active,
        stage: data.stage ?? existing.stage,
        driveFolder: data.driveFolder ?? existing.driveFolder,
        updates: data.updates ?? [],
        files: data.files ?? [],
        revisions: data.revisions ?? [],
        invoices: data.invoices ?? [],
        staging: data.staging ?? existing.staging,
        feedbackOpen: data.feedbackOpen ?? existing.feedbackOpen,
        feedback: existing.feedback,
        widgetKey: existing.widgetKey || generateWidgetKey(),
        lastSeenByClient: existing.lastSeenByClient,
        // Pipeline moves only through /api/agents/pipeline (so every
        // transition is logged); portal saves never touch it.
        pipeline: existing.pipeline,
        // Draft replies are managed through the feedback route only.
        draftReplies: existing.draftReplies,
        // GitHub username is set at handoff, not through portal saves.
        githubUser: existing.githubUser,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

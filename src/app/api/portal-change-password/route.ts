import { NextRequest, NextResponse } from 'next/server';
import { verifyPortalSession } from '@/lib/portal-auth';
import { getClientBySlug, writeClient } from '@/lib/clients';
import { verifyPassword, hashPassword } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/** Self-service password change from inside the portal (requires the current password). */
export async function POST(req: NextRequest) {
  const slug = await verifyPortalSession(req.cookies.get('portal_session')?.value);
  if (!slug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as { currentPassword?: string; newPassword?: string };
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Enter your current password and a new one.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
    }

    const client = await getClientBySlug(slug);
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    if (!verifyPassword(currentPassword, client.passwordHash)) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }

    writeClient(slug, {
      passwordHash: hashPassword(newPassword),
      data: {
        name: client.name, email: client.email, phone: client.phone, internalNotes: client.internalNotes,
        projectName: client.projectName, active: client.active, stage: client.stage, driveFolder: client.driveFolder,
        updates: client.updates, files: client.files, revisions: client.revisions, invoices: client.invoices,
        staging: client.staging, feedbackOpen: client.feedbackOpen, feedback: client.feedback,
        widgetKey: client.widgetKey, lastSeenByClient: client.lastSeenByClient, pipeline: client.pipeline,
        draftReplies: client.draftReplies, githubUser: client.githubUser,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

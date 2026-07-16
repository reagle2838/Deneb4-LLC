import { NextRequest, NextResponse } from 'next/server';
import { getClientByEmail, writeClient } from '@/lib/clients';
import { generateClientPassword, hashPassword } from '@/lib/portal-auth';
import { notifyClientCredentials } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * Client-initiated password reset ("forgot password" on /login). Generates
 * a fresh password and emails it via the same tested credentials path used
 * everywhere else. Always returns a generic success message regardless of
 * whether the email matched a client — never reveal which emails exist.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? '').trim();
    if (!email) return NextResponse.json({ error: 'Enter your email.' }, { status: 400 });

    const client = await getClientByEmail(email);
    if (client && client.active) {
      const password = generateClientPassword();
      writeClient(client.slug, {
        passwordHash: hashPassword(password),
        data: {
          name: client.name, email: client.email, phone: client.phone, internalNotes: client.internalNotes,
          projectName: client.projectName, active: client.active, stage: client.stage, driveFolder: client.driveFolder,
          updates: client.updates, files: client.files, revisions: client.revisions, invoices: client.invoices,
          staging: client.staging, feedbackOpen: client.feedbackOpen, feedback: client.feedback,
          widgetKey: client.widgetKey, lastSeenByClient: client.lastSeenByClient, pipeline: client.pipeline,
          draftReplies: client.draftReplies, githubUser: client.githubUser,
        },
      });
      await notifyClientCredentials(client, password, 'reset');
    }

    return NextResponse.json({
      ok: true,
      message: "If that email matches a project, we've sent a new password to it.",
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

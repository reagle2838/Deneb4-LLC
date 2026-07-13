import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { slugify, clientExists, writeClient, getClientBySlug, EMPTY_STAGING, generateWidgetKey } from '@/lib/clients';
import { generateClientPassword, hashPassword } from '@/lib/portal-auth';
import { appendLedger } from '@/lib/agent-ledger';
import { notifyClientCredentials } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { name?: string; email?: string; projectName?: string; sendWelcome?: boolean };
    const name = (body.name ?? '').trim();
    const email = (body.email ?? '').trim();
    const projectName = (body.projectName ?? '').trim();
    const sendWelcome = body.sendWelcome === true;

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
    const widgetKey = generateWidgetKey();

    writeClient(slug, {
      passwordHash,
      data: {
        name,
        email,
        phone: '',
        internalNotes: '',
        projectName,
        active: true,
        stage: '',
        driveFolder: '',
        updates: [],
        files: [],
        revisions: [],
        invoices: [],
        staging: EMPTY_STAGING,
        feedbackOpen: false,
        feedback: [],
        widgetKey,
        lastSeenByClient: '',
        pipeline: 'onboarding',
        draftReplies: [],
        githubUser: '',
      },
    });

    // Birth record on the client's agent channel.
    appendLedger(slug, {
      agent: 'concierge',
      kind: 'event',
      message: `Client created and portal provisioned for ${name}. Pipeline starts at Onboarding.`,
      data: { email, projectName },
    });

    let welcomed = false;
    if (sendWelcome) {
      const client = await getClientBySlug(slug);
      if (client) welcomed = await notifyClientCredentials(client, password, 'welcome');
    }

    return NextResponse.json({ slug, password, widgetKey, welcomed });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

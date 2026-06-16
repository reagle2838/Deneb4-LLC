import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { generateClientPassword, hashPassword } from '@/lib/portal-auth';
import fs from 'fs';
import path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Must be authenticated as Ridhi (CMS admin)
  const cmsToken = req.cookies.get('cms_auth')?.value;
  if (!(await verifySession(cmsToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json() as { clientSlug?: string };
    const { clientSlug } = body;
    if (!clientSlug) {
      return NextResponse.json({ error: 'Missing clientSlug' }, { status: 400 });
    }

    const yamlPath = path.join(process.cwd(), 'content', 'clients', clientSlug, 'index.yaml');
    if (!fs.existsSync(yamlPath)) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Generate a new password and hash it
    const plainPassword = generateClientPassword();
    const hash = hashPassword(plainPassword);

    // Read, parse, update, and write the YAML file
    const raw = fs.readFileSync(yamlPath, 'utf-8');
    const parsed = yamlLoad(raw) as Record<string, unknown>;
    parsed.passwordHash = hash;
    const updated = yamlDump(parsed, { lineWidth: -1, quotingType: "'" });
    fs.writeFileSync(yamlPath, updated, 'utf-8');

    return NextResponse.json({ password: plainPassword });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

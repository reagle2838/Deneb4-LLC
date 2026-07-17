import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { listTemplates, importTemplateZip, deleteTemplate, pushTemplateToStardrive } from '@/lib/template-library';

export const dynamic = 'force-dynamic';

/**
 * The studio template library — CMS-session only (this is Ridhi's no-code
 * upload surface, not an agent lane). GET lists; POST actions:
 *   import         { zipBase64 }  — unpack, template-kit gate, store + register
 *   delete         { name }
 *   push-stardrive { name }       — POST the stored bundle to the Stardrive API
 */

async function isCms(req: NextRequest): Promise<boolean> {
  return verifySession(req.cookies.get('cms_auth')?.value);
}

export async function GET(req: NextRequest) {
  if (!(await isCms(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ templates: listTemplates() });
}

export async function POST(req: NextRequest) {
  if (!(await isCms(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action?: string; zipBase64?: string; name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    if (body.action === 'import') {
      if (!body.zipBase64) return NextResponse.json({ error: 'zipBase64 required.' }, { status: 400 });
      const result = importTemplateZip(body.zipBase64);
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }
    if (body.action === 'delete') {
      if (!body.name) return NextResponse.json({ error: 'name required.' }, { status: 400 });
      const ok = deleteTemplate(body.name);
      return ok
        ? NextResponse.json({ ok: true, deleted: body.name })
        : NextResponse.json({ error: `No template "${body.name}" in the library.` }, { status: 404 });
    }
    if (body.action === 'push-stardrive') {
      if (!body.name) return NextResponse.json({ error: 'name required.' }, { status: 400 });
      const out = await pushTemplateToStardrive(body.name);
      return NextResponse.json({ ok: out.status < 400, stardrive: out.body }, { status: out.status < 400 ? 200 : 502 });
    }
    return NextResponse.json({ error: `Unknown action "${body.action}".` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed.' }, { status: 500 });
  }
}

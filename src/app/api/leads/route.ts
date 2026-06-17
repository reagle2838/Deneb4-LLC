import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { writeLeads, LEAD_STAGES, type Lead, type LeadStage } from '@/lib/leads';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { leads?: Lead[] };
    if (!Array.isArray(body.leads)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }
    const leads: Lead[] = body.leads.map((l) => ({
      id: String(l.id ?? ''),
      name: String(l.name ?? ''),
      email: String(l.email ?? ''),
      company: String(l.company ?? ''),
      source: l.source === 'start' ? 'start' : 'contact',
      stage: (LEAD_STAGES.includes(l.stage) ? l.stage : 'new') as LeadStage,
      message: String(l.message ?? ''),
      createdAt: String(l.createdAt ?? ''),
    }));
    writeLeads(leads);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

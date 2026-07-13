import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import { getClientBySlug } from '@/lib/clients';
import { getLedger } from '@/lib/agent-ledger';
import { getConsultations } from '@/lib/consultations';
import { getEmailLog } from '@/lib/email-log';
import { getProposedInvoices } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/**
 * The unified per-client communications timeline: everything that has ever
 * passed between the studio and this client — portal/widget messages both
 * directions, pending draft replies, every email's actual content, phone
 * consultations with their summaries, sent invoices, and the agents'
 * ledger record — merged chronologically. One view answers "what happened
 * on this project?" instead of three panels. CMS-only: it contains
 * internal material (drafts, agent alerts) a client must never see.
 */

export interface TimelineItem {
  date: string;
  source: 'message' | 'draft' | 'email' | 'consultation' | 'invoice' | 'ledger';
  from: string;
  title: string;
  detail: string;
  meta?: string;
}

export async function GET(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  const client = slug ? await getClientBySlug(slug) : null;
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  const items: TimelineItem[] = [];

  for (const m of client.feedback) {
    items.push({
      date: m.date,
      source: 'message',
      from: m.author === 'client' ? client.name : 'Deneb4',
      title: m.author === 'client' ? `Message from ${client.name}${m.page ? ` (re: ${m.page})` : ''}` : 'Reply sent',
      detail: m.message,
      meta: m.resolved ? 'resolved' : undefined,
    });
  }

  for (const d of client.draftReplies) {
    items.push({
      date: d.date,
      source: 'draft',
      from: d.createdBy,
      title: 'Draft reply (awaiting your approval, client has NOT seen this)',
      detail: d.message,
    });
  }

  for (const e of getEmailLog(slug)) {
    items.push({
      date: e.date,
      source: 'email',
      from: e.direction === 'to-client' ? 'Deneb4 → client' : 'system → Ridhi',
      title: `Email: ${e.subject}`,
      detail: e.text,
      meta: e.delivered ? 'delivered' : 'not delivered (email not configured)',
    });
  }

  for (const c of getConsultations(slug)) {
    items.push({
      date: c.date,
      source: 'consultation',
      from: 'phone call',
      title: `Consultation (${c.durationMin} min)`,
      detail: c.summary,
    });
  }

  for (const p of getProposedInvoices(slug).filter((p) => p.status === 'sent')) {
    items.push({
      date: p.resolvedDate ?? p.date,
      source: 'invoice',
      from: 'billing',
      title: `Invoice sent: ${p.description}`,
      detail: `$${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}, due ${p.dueDate}.`,
    });
  }

  for (const l of getLedger(slug)) {
    items.push({
      date: l.date,
      source: 'ledger',
      from: l.agent,
      title: `[${l.kind}] ${l.message.split('\n')[0].slice(0, 120)}`,
      detail: l.message,
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({ ok: true, items });
}

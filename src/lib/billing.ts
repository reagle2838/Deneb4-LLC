import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import type { Client, ClientInvoice } from './clients';
import { getAllClients, getClientBySlug, setPipelineStage } from './clients';
import { appendLedger } from './agent-ledger';
import { getState, setState } from './agent-state';
import { notifyOwnerOfAgentAlert, notifyClientOfInvoice } from './notify';
import { computeQuote, money, type Quote } from './pricing';
import { hasBuildConfig } from './comms';
import { generateHandoffPackage } from './handoff';
import type { DutyResult } from './agent-roster';

/**
 * The Billing agent, automated end to end with ONE human gate: Ridhi
 * approves each invoice before it is sent (docs/agents.md amendment
 * 2026-07-12). Everything else runs itself:
 *
 *  - Once a client has a build config and the build has started, the
 *    DEPOSIT invoice (50% of the quote) is drafted automatically.
 *  - When the client signs off (recordClientSignoff), the pipeline
 *    advances to payment and the FINAL invoice (balance + any post-quote
 *    items like extra consultations) is drafted automatically.
 *  - Ridhi clicks "Approve & send" on the Billing panel: the invoice lands
 *    on the client's portal record and they get the itemized email.
 *  - When every sent invoice is marked paid, the pipeline auto-advances to
 *    handoff and the handoff package is generated (credentials rotated) —
 *    Ridhi's remaining handoff job is delivery.
 *
 * Every quote is checked against the pricing floor (pricing.ts); a quote
 * that doesn't clear the margin guardrail alerts instead of proceeding
 * quietly. Payment DETECTION is still the recorded invoice statuses Ridhi
 * marks (Wave API replaces the marking later; the flow stays).
 */

export interface ProposedInvoice {
  id: string;
  kind: 'deposit' | 'final';
  description: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  lines: { label: string; amount: string }[];
  status: 'proposed' | 'sent' | 'rejected';
  date: string;
  resolvedDate?: string;
  note?: string;
}

const BILLING_DIR = path.join(process.cwd(), 'content', 'admin', 'billing');
const billingPath = (slug: string) => path.join(BILLING_DIR, `${slug}.yaml`);

export function getProposedInvoices(slug: string): ProposedInvoice[] {
  const file = billingPath(slug);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = yamlLoad(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(raw) ? (raw as ProposedInvoice[]) : [];
  } catch {
    return [];
  }
}

function writeProposed(slug: string, list: ProposedInvoice[]): void {
  if (!fs.existsSync(BILLING_DIR)) fs.mkdirSync(BILLING_DIR, { recursive: true });
  fs.writeFileSync(billingPath(slug), yamlDump(list, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

export function countProposedInvoices(slug: string): number {
  return getProposedInvoices(slug).filter((p) => p.status === 'proposed').length;
}

const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const hasKind = (slug: string, kind: ProposedInvoice['kind']) =>
  getProposedInvoices(slug).some((p) => p.kind === kind && p.status !== 'rejected');

async function marginAlert(client: Client, quote: Quote): Promise<void> {
  const key = `billingMarginAlert:${client.slug}`;
  if (getState(key)) return;
  const msg = `${client.name}'s quote (${money(quote.total)}) is only ${quote.marginMultiple}x the cost floor (${money(quote.costFloor)}) — below the guardrail in content/admin/pricing.yaml. Review the pricing before sending.`;
  appendLedger(client.slug, { agent: 'billing', kind: 'alert', message: msg });
  await notifyOwnerOfAgentAlert(client.slug, 'billing', msg);
  setState(key, new Date().toISOString());
}

/** Draft the 50% deposit invoice from the quote. Returns null without a config. */
export async function proposeDeposit(client: Client): Promise<ProposedInvoice | null> {
  const quote = computeQuote(client.slug);
  if (!quote) return null;
  if (!quote.marginOk) await marginAlert(client, quote);
  const proposal: ProposedInvoice = {
    id: crypto.randomUUID(),
    kind: 'deposit',
    description: 'Build deposit (50%)',
    amount: quote.deposit,
    dueDate: plusDays(7),
    lines: [
      ...quote.lines.map((l) => ({ label: l.label, amount: money(l.amount) })),
      { label: `Project total ${money(quote.total)} — 50% deposit due now, balance at handoff`, amount: money(quote.deposit) },
    ],
    status: 'proposed',
    date: new Date().toISOString(),
  };
  writeProposed(client.slug, [...getProposedInvoices(client.slug), proposal]);
  appendLedger(client.slug, {
    agent: 'billing',
    kind: 'event',
    message: `Deposit invoice drafted (${money(quote.deposit)} of ${money(quote.total)} total; cost floor ${money(quote.costFloor)}, ${quote.marginMultiple}x margin). Waiting for your "Approve & send" on the Billing panel.`,
  });
  return proposal;
}

/** Draft the final invoice: balance + anything that happened after the quote. */
export async function proposeFinal(client: Client): Promise<ProposedInvoice | null> {
  const quote = computeQuote(client.slug);
  if (!quote) return null;
  if (!quote.marginOk) await marginAlert(client, quote);
  // What was already billed as the deposit (sent or proposed) comes off the top.
  const deposit = getProposedInvoices(client.slug).find((p) => p.kind === 'deposit' && p.status === 'sent');
  const depositAmount = deposit?.amount ?? quote.deposit;
  const amount = Math.max(0, Math.round((quote.total - depositAmount) * 100) / 100);
  const proposal: ProposedInvoice = {
    id: crypto.randomUUID(),
    kind: 'final',
    description: 'Final balance at handoff',
    amount,
    dueDate: plusDays(14),
    lines: [
      ...quote.lines.map((l) => ({ label: l.label, amount: money(l.amount) })),
      { label: `Project total`, amount: money(quote.total) },
      { label: `Less deposit received`, amount: `-${money(depositAmount)}` },
    ],
    status: 'proposed',
    date: new Date().toISOString(),
  };
  writeProposed(client.slug, [...getProposedInvoices(client.slug), proposal]);
  appendLedger(client.slug, {
    agent: 'billing',
    kind: 'event',
    message: `Final invoice drafted (${money(amount)}; total ${money(quote.total)} less deposit ${money(depositAmount)}). Waiting for your "Approve & send" on the Billing panel.`,
  });
  return proposal;
}

/**
 * Ridhi's gate: send the invoice. Moves it onto the client's portal record
 * (status pending) and emails the itemized invoice. Returns the sent
 * proposal or null.
 */
export async function approveSendInvoice(slug: string, id: string): Promise<ProposedInvoice | null> {
  const list = getProposedInvoices(slug);
  const target = list.find((p) => p.id === id && p.status === 'proposed');
  const client = await getClientBySlug(slug);
  if (!target || !client) return null;

  const invoice: ClientInvoice = {
    description: target.description,
    amount: money(target.amount),
    status: 'pending',
    dueDate: target.dueDate,
  };
  // Persist onto the client's portal record.
  const { setInvoices } = await import('./clients');
  setInvoices(slug, [...client.invoices, invoice]);

  const emailed = await notifyClientOfInvoice(client, invoice, target.lines);
  target.status = 'sent';
  target.resolvedDate = new Date().toISOString();
  target.note = emailed ? 'Emailed to the client.' : 'Recorded on the portal; email not configured, share it yourself.';
  writeProposed(slug, list);

  appendLedger(slug, {
    agent: 'ridhi',
    kind: 'decision',
    message: `Approved & sent: ${target.description}, ${money(target.amount)}, due ${target.dueDate}. ${target.note}`,
  });
  return target;
}

export function rejectInvoice(slug: string, id: string, note?: string): ProposedInvoice | null {
  const list = getProposedInvoices(slug);
  const target = list.find((p) => p.id === id && p.status === 'proposed');
  if (!target) return null;
  target.status = 'rejected';
  target.resolvedDate = new Date().toISOString();
  if (note) target.note = note.slice(0, 300);
  writeProposed(slug, list);
  appendLedger(slug, {
    agent: 'ridhi',
    kind: 'decision',
    message: `Rejected drafted invoice: ${target.description} (${money(target.amount)}).${note ? ` Note: ${note}` : ''} Adjust content/admin/pricing.yaml or the build config and it will re-draft.`,
  });
  return target;
}

// ── The heartbeat duty ────────────────────────────────────────────────────

const nudgedKey = (slug: string, what: string) => `billingNudged:${slug}:${what}`;
const DEPOSIT_STAGES = ['building', 'internal-review', 'client-review'];

export async function billingWatchDuty(): Promise<DutyResult> {
  const clients = await getAllClients();
  let drafted = 0;
  let nudges = 0;
  let advanced = 0;

  for (const client of clients.filter((c) => c.active)) {
    // 1. Deposit drafting: as soon as a build exists to bill for.
    if (DEPOSIT_STAGES.includes(client.pipeline) && hasBuildConfig(client.slug) && !hasKind(client.slug, 'deposit')) {
      if (await proposeDeposit(client)) drafted++;
    }

    if (client.pipeline !== 'payment') continue;

    // 2. Belt-and-suspenders: a payment-stage client should have a final draft.
    if (!hasKind(client.slug, 'final')) {
      if (await proposeFinal(client)) drafted++;
    }

    // 3. Watch the sent invoices Ridhi marks paid.
    const unpaid = client.invoices.filter((i) => i.status !== 'paid');
    if (client.invoices.length > 0 && unpaid.length === 0) {
      // Everything paid: advance to handoff and prepare the package. The
      // remaining human touch at handoff is delivering it.
      setPipelineStage(client.slug, 'handoff');
      appendLedger(client.slug, {
        agent: 'billing',
        kind: 'handoff',
        message: 'Pipeline stage: Payment → Handoff (every invoice paid; advanced automatically).',
      });
      const fresh = await getClientBySlug(client.slug);
      if (fresh) {
        const { rotated } = generateHandoffPackage(fresh);
        await notifyOwnerOfAgentAlert(
          client.slug,
          'billing',
          `${client.name} is fully paid. Advanced to Handoff and generated the handoff package${rotated ? ' (admin password rotated)' : ''} — review it in the Workspace and deliver it to the client.`
        );
      }
      advanced++;
      continue;
    }

    // 4. Overdue detection, once per invoice.
    const today = new Date().toISOString().slice(0, 10);
    for (const inv of unpaid) {
      if (inv.status === 'pending' && inv.dueDate && inv.dueDate < today) {
        const key = nudgedKey(client.slug, `overdue:${inv.dueDate}:${inv.description.slice(0, 30)}`);
        if (!getState(key)) {
          const msg = `${client.name}: invoice "${inv.description}" (${inv.amount}) was due ${inv.dueDate} and is still pending. Consider marking it overdue and following up.`;
          appendLedger(client.slug, { agent: 'billing', kind: 'alert', message: msg });
          await notifyOwnerOfAgentAlert(client.slug, 'billing', msg);
          setState(key, new Date().toISOString());
          nudges++;
        }
      }
    }
  }

  return {
    name: 'billing-watch',
    status: 'ok',
    summary: `${drafted} invoice(s) drafted, ${nudges} nudge(s), ${advanced} advanced to handoff.`,
  };
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import type { Client, ClientInvoice } from './clients';
import { addClientFile, getAllClients, getClientBySlug, setPipelineStage } from './clients';
import { appendLedger } from './agent-ledger';
import { getState, setState } from './agent-state';
import { notifyOwnerOfAgentAlert, notifyClientOfInvoice, notifyClientOfHandoffReady } from './notify';
import { computeQuote, money, type Quote } from './pricing';
import { hasBuildConfig } from './comms';
import { generateHandoffPackage } from './handoff';
import { applyStagedConfig, getQuoteRecord } from './quotes';
import { spawnBuilder } from './builder-spawn';
import { callGas } from './gas-bridge';
import { waveEnabled, ensureCustomer, createInvoice, markInvoiceSent, getInvoiceStatus, isSettled } from './wave';
import type { DutyResult } from './agent-roster';
import { assertSafeSlug } from './agent-auth';

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
  /** Set when the send went through Wave: the real invoice's id + link. */
  waveId?: string;
  waveViewUrl?: string;
}

const BILLING_DIR = path.join(process.cwd(), 'content', 'admin', 'billing');
const billingPath = (slug: string) => path.join(BILLING_DIR, `${assertSafeSlug(slug)}.yaml`);

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

/**
 * The quote-approval adjustment (Ridhi's deny-with-instructions loop can
 * grant e.g. "$200 off"); applied on top of the price-book quote.
 */
function quoteAdjustment(slug: string): number {
  return getQuoteRecord(slug)?.adjustmentUsd ?? 0;
}

/** Draft the 50% deposit invoice from the quote. Returns null without a config. */
export async function proposeDeposit(client: Client): Promise<ProposedInvoice | null> {
  const quote = computeQuote(client.slug);
  if (!quote) return null;
  if (!quote.marginOk) await marginAlert(client, quote);
  const adj = quoteAdjustment(client.slug);
  const total = Math.round((quote.total + adj) * 100) / 100;
  const deposit = Math.round((total / 2) * 100) / 100;
  const proposal: ProposedInvoice = {
    id: crypto.randomUUID(),
    kind: 'deposit',
    description: 'Build deposit (50%)',
    amount: deposit,
    dueDate: plusDays(7),
    lines: [
      ...quote.lines.map((l) => ({ label: l.label, amount: money(l.amount) })),
      ...(adj ? [{ label: 'Adjustment (per quote approval)', amount: money(adj) }] : []),
      { label: `Project total ${money(total)} — 50% deposit due now, balance at handoff`, amount: money(deposit) },
    ],
    status: 'proposed',
    date: new Date().toISOString(),
  };
  writeProposed(client.slug, [...getProposedInvoices(client.slug), proposal]);
  appendLedger(client.slug, {
    agent: 'billing',
    kind: 'event',
    message: `Deposit invoice drafted (${money(deposit)} of ${money(total)} total; cost floor ${money(quote.costFloor)}, ${quote.marginMultiple}x margin). Waiting for your "Approve & send" on the Billing panel.`,
  });
  return proposal;
}

/** Draft the final invoice: balance + anything that happened after the quote. */
export async function proposeFinal(client: Client): Promise<ProposedInvoice | null> {
  const quote = computeQuote(client.slug);
  if (!quote) return null;
  if (!quote.marginOk) await marginAlert(client, quote);
  const adj = quoteAdjustment(client.slug);
  const total = Math.round((quote.total + adj) * 100) / 100;
  // What was already billed as the deposit (sent or proposed) comes off the top.
  const deposit = getProposedInvoices(client.slug).find((p) => p.kind === 'deposit' && p.status === 'sent');
  const depositAmount = deposit?.amount ?? Math.round((total / 2) * 100) / 100;
  const amount = Math.max(0, Math.round((total - depositAmount) * 100) / 100);
  const proposal: ProposedInvoice = {
    id: crypto.randomUUID(),
    kind: 'final',
    description: 'Final balance at handoff',
    amount,
    dueDate: plusDays(14),
    lines: [
      ...quote.lines.map((l) => ({ label: l.label, amount: money(l.amount) })),
      ...(adj ? [{ label: 'Adjustment (per quote approval)', amount: money(adj) }] : []),
      { label: `Project total`, amount: money(total) },
      { label: `Less deposit received`, amount: `-${money(depositAmount)}` },
    ],
    status: 'proposed',
    date: new Date().toISOString(),
  };
  writeProposed(client.slug, [...getProposedInvoices(client.slug), proposal]);
  appendLedger(client.slug, {
    agent: 'billing',
    kind: 'event',
    message: `Final invoice drafted (${money(amount)}; total ${money(total)} less deposit ${money(depositAmount)}). Waiting for your "Approve & send" on the Billing panel.`,
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

  // Wave path: put the invoice on the real books first. Wave failure never
  // blocks the send — we fall back to the local-only flow and say so.
  let waveNote = '';
  if (waveEnabled()) {
    try {
      const customerId = await ensureCustomer(slug, client.name, client.email);
      const memo = target.lines.map((l) => `${l.label}: ${l.amount}`).join('\n');
      const wave = await createInvoice({
        customerId,
        description: target.description,
        amount: target.amount,
        dueDate: target.dueDate,
        memo,
      });
      await markInvoiceSent(wave.id);
      target.waveId = wave.id;
      target.waveViewUrl = wave.viewUrl;
      waveNote = ` On the books as Wave invoice #${wave.invoiceNumber}; payment will be detected automatically.`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLedger(slug, {
        agent: 'billing',
        kind: 'alert',
        message: `Wave invoice creation failed (${msg}). The invoice was still sent the local way — record it in Wave by hand and mark it paid here when money arrives.`,
      });
    }
  }

  const invoice: ClientInvoice = {
    description: target.description,
    amount: money(target.amount),
    status: 'pending',
    dueDate: target.dueDate,
    ...(target.waveViewUrl ? { invoiceUrl: target.waveViewUrl } : {}),
  };
  // Persist onto the client's portal record.
  const { setInvoices } = await import('./clients');
  setInvoices(slug, [...client.invoices, invoice]);

  const emailed = await notifyClientOfInvoice(client, invoice, target.lines, target.waveViewUrl);
  target.status = 'sent';
  target.resolvedDate = new Date().toISOString();
  target.note =
    (emailed ? 'Emailed to the client.' : 'Recorded on the portal; email not configured, share it yourself.') + waveNote;
  writeProposed(slug, list);

  appendLedger(slug, {
    agent: 'ridhi',
    kind: 'decision',
    message: `Approved & sent: ${target.description}, ${money(target.amount)}, due ${target.dueDate}. ${target.note}`,
  });
  return target;
}

/**
 * Payment detection (Wave): check every sent-with-a-waveId invoice that is
 * still unpaid locally; when Wave says it's settled, flip the local record
 * and tell the ledger. Runs for any active client — deposits are sent long
 * before the payment stage. Returns how many were flipped.
 */
async function detectWavePayments(client: Client): Promise<number> {
  if (!waveEnabled()) return 0;
  const proposals = getProposedInvoices(client.slug).filter((p) => p.status === 'sent' && p.waveId);
  if (proposals.length === 0) return 0;

  const unpaidLocal = client.invoices.filter((i) => i.status !== 'paid');
  if (unpaidLocal.length === 0) return 0;

  let flipped = 0;
  const updated = [...client.invoices];
  for (const p of proposals) {
    const idx = updated.findIndex((i) => i.description === p.description && i.status !== 'paid');
    if (idx === -1) continue;
    try {
      const status = await getInvoiceStatus(p.waveId!);
      if (status && isSettled(status)) {
        updated[idx] = { ...updated[idx], status: 'paid' };
        flipped++;
        appendLedger(client.slug, {
          agent: 'billing',
          kind: 'event',
          message: `Payment received: ${p.description} (${money(p.amount)}) — detected automatically via Wave (status ${status.status}).`,
        });
      }
    } catch (err) {
      // Detection is best-effort; a Wave hiccup must not fail the duty.
      console.error(`[deneb4] Wave status check failed for ${client.slug}:`, err instanceof Error ? err.message : err);
    }
  }
  if (flipped > 0) {
    const { setInvoices } = await import('./clients');
    setInvoices(client.slug, updated);
  }
  return flipped;
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

  for (let client of clients.filter((c) => c.active)) {
    const quoteRecord = getQuoteRecord(client.slug);

    // 1. Deposit drafting. Phase 14 path: the client confirmed the quote
    //    (confirmQuoteAndKickoff usually drafts it in the same breath; this
    //    is the belt-and-suspenders). Legacy path (no quote record, e.g.
    //    pre-Phase-14 demo clients): once a build config exists at a build
    //    stage.
    const quoteConfirmed = quoteRecord?.status === 'confirmed';
    const legacyDepositDue =
      !quoteRecord && DEPOSIT_STAGES.includes(client.pipeline) && hasBuildConfig(client.slug);
    if ((quoteConfirmed || legacyDepositDue) && hasBuildConfig(client.slug) && !hasKind(client.slug, 'deposit')) {
      if (await proposeDeposit(client)) drafted++;
    }

    // 2. Wave payment detection, any stage (deposits are sent early).
    const detected = await detectWavePayments(client);
    if (detected > 0) {
      const fresh = await getClientBySlug(client.slug);
      if (fresh) client = fresh; // the all-paid check below must see the flip
    }

    // 3. Deposit settled → the build starts. This is the Phase 14 gate
    //    order: quote confirmed (Ridhi + client) and money in hand BEFORE
    //    the Builder runs. Advancing to `building` here is what un-gates
    //    the Builder; the spawn is fire-and-forget and reports itself.
    if (quoteConfirmed && ['onboarding', 'intake-review'].includes(client.pipeline)) {
      const sentDeposit = getProposedInvoices(client.slug).find((p) => p.kind === 'deposit' && p.status === 'sent');
      const depositPaid =
        sentDeposit && client.invoices.some((i) => i.description === sentDeposit.description && i.status === 'paid');
      if (depositPaid) {
        const applied = applyStagedConfig(client.slug); // usually 'already-applied' (confirm did it)
        if (applied === 'no-staged-config' && !hasBuildConfig(client.slug)) {
          const msg = `${client.name}: deposit is paid but there is no build config (staged or applied) — the build cannot start. Stage or apply a config.`;
          appendLedger(client.slug, { agent: 'builder', kind: 'alert', message: msg });
          await notifyOwnerOfAgentAlert(client.slug, 'builder', msg);
        } else {
          setPipelineStage(client.slug, 'building');
          const { note } = spawnBuilder(client.slug, process.env.SITE_URL);
          appendLedger(client.slug, {
            agent: 'builder',
            kind: 'handoff',
            message: `Deposit paid — pipeline advanced to Building automatically (Phase 14: quote + deposit are the start gate). ${note}`,
          });
          await callGas(client.slug, 'build_started', {});
          advanced++;
        }
      }
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
        // Phase 14: agentic delivery, but never credentials over email. The
        // package is exposed as an authenticated portal download (Files
        // section) and the client gets a no-secrets notification email.
        addClientFile(client.slug, {
          name: 'Handoff package',
          url: '/api/portal-handoff',
          description:
            'Your ownership handover: fresh admin login, what you own, and a getting-started checklist. Only available behind your portal login.',
          date: new Date().toISOString().slice(0, 10),
        });
        const emailed = await notifyClientOfHandoffReady(fresh);
        await callGas(client.slug, 'project_paid', {});
        await notifyOwnerOfAgentAlert(
          client.slug,
          'billing',
          `${client.name} is fully paid. Advanced to Handoff, generated the handoff package${rotated ? ' (admin password rotated)' : ''}, and delivered it via their portal Files section${emailed ? ' (client notified by email)' : ''}. If they asked for a GitHub transfer, trigger it from the Handoff panel.`
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

/**
 * Quote-gate orchestration (Phase 14). quotes.ts owns state, billing.ts
 * owns invoices; this thin layer sequences the cross-lib moments so the
 * portal route and the GAS webhook share one code path:
 *
 *   approveQuoteAndNotify  — Ridhi approved: portal item + email + GAS
 *   confirmQuoteAndKickoff — client confirmed: apply config + draft deposit
 */
import { addClientFile, appendUpdate, getClientBySlug } from '@/lib/clients';
import { appendLedger } from '@/lib/agent-ledger';
import { notifyClientOfQuote, notifyOwnerOfAgentAlert } from '@/lib/notify';
import { money } from '@/lib/pricing';
import { proposeDeposit } from '@/lib/billing';
import { callGas } from '@/lib/gas-bridge';
import { generateScopeDocument, signScopeDocument } from '@/lib/scope';
import {
  QUOTE_PHASE,
  applyStagedConfig,
  clientConfirmQuote,
  quoteTotal,
  ridhiApproveQuote,
} from '@/lib/quotes';

/** Ridhi approved the quote: put it in front of the client. */
export async function approveQuoteAndNotify(slug: string): Promise<{ ok: boolean; detail: string }> {
  const record = ridhiApproveQuote(slug);
  if (!record) return { ok: false, detail: 'No quote awaiting your approval for this client.' };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, detail: 'Client not found.' };

  const total = money(quoteTotal(record));
  const lineSummary = record.quote.lines.map((l) => `${l.label}: ${money(l.amount)}`).join(' · ');
  appendUpdate(slug, {
    phase: QUOTE_PHASE,
    status: 'pending-signoff',
    notes: `Your project quote is ${total} (half up front, half at handoff). ${lineSummary}${record.adjustmentUsd ? ` · Adjustment: ${money(record.adjustmentUsd)}` : ''}. Approve to receive the deposit invoice — building starts when the deposit clears.`,
    date: new Date().toISOString(),
  });
  // Generate the scope agreement now, unsigned — the client signs it in
  // the same action as confirming the quote (see confirmQuoteAndKickoff).
  generateScopeDocument(slug, client.projectName || client.name, record.quote, record.adjustmentUsd);
  const emailed = await notifyClientOfQuote(client, total);
  await callGas(slug, 'quote_approved', { total });
  appendLedger(slug, {
    agent: 'billing',
    kind: 'decision',
    message: `Quote approved by Ridhi (${total}), scope agreement drafted, and sent to the client for confirmation${emailed ? ' (email delivered)' : ' (email not delivered — they will see it in the portal)'}.`,
  });
  return { ok: true, detail: `Quote (${total}) is now awaiting the client's confirmation.` };
}

/**
 * The client confirmed the quote — in the same action, they sign the scope
 * agreement (typed full name, captured with an IP + timestamp; the
 * in-house replacement for GAS's e-signature + PDF-lock, per Ridhi's
 * 2026-07-16 decision). The confirmed scope becomes the applied build
 * config and the deposit invoice drafts for Ridhi's send — the build
 * itself starts only when that deposit is PAID (billingWatchDuty).
 *
 * `signature` is required for the portal path (the client must type their
 * name to confirm) but optional for the GAS `quote_signed` webhook path,
 * where her own Quote Authorization Form is the signing instrument — if
 * she ever adds one — and Deneb4's scope doc stays generated-but-unsigned
 * rather than double-signing.
 */
export async function confirmQuoteAndKickoff(
  slug: string,
  signature?: { typedName: string; ip: string }
): Promise<{ ok: boolean; detail: string }> {
  const record = clientConfirmQuote(slug);
  if (!record) return { ok: false, detail: 'No quote awaiting client confirmation.' };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, detail: 'Client not found.' };

  const applied = applyStagedConfig(slug);
  const deposit = await proposeDeposit(client);

  let scopeNote = '';
  if (signature) {
    const signed = signScopeDocument(slug, signature.typedName, signature.ip);
    if (signed) {
      addClientFile(slug, {
        name: 'Signed project scope',
        url: '/api/portal-scope',
        description: `Signed by ${signed.signature?.typedName} on ${signed.signature?.signedAt.slice(0, 10)}. Only available behind your portal login.`,
        date: new Date().toISOString().slice(0, 10),
      });
      scopeNote = ` Scope agreement signed by "${signature.typedName}" and locked.`;
    } else {
      scopeNote = ' (Scope agreement was already signed or missing — check content/admin/scope/.)';
    }
  }

  await callGas(slug, 'quote_confirmed', { total: money(quoteTotal(record)) });
  const msg = `${client.name} confirmed the quote (${money(quoteTotal(record))}).${scopeNote} Config ${applied === 'applied' ? 'applied from intake' : applied === 'already-applied' ? 'was already applied' : 'MISSING — stage one before the build can start'}; ${deposit ? `deposit invoice drafted (${money(deposit.amount)}) and waiting for your Approve & send` : 'deposit could not be drafted — check the build config'}. The build starts automatically when the deposit is paid.`;
  appendLedger(slug, { agent: 'billing', kind: 'decision', message: msg });
  await notifyOwnerOfAgentAlert(slug, 'billing', msg);
  return { ok: true, detail: msg };
}

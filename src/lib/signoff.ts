import type { Client } from './clients';
import { getAllClients, appendUpdate, setPipelineStage } from './clients';
import { appendLedger } from './agent-ledger';
import { getState, setState } from './agent-state';
import { notifyClientOfSignoffRequest } from './notify';
import { callGas } from './gas-bridge';
import type { DutyResult } from './agent-roster';

/**
 * The sign-off request flow (docs/agents.md: Comms owns `approval`, and
 * leaving it is the client-sign-off gate).
 *
 * Moving a client to the `approval` stage is Ridhi's own action, so the
 * request itself goes out autonomously with fixed, pre-approved wording:
 * a "Final approval" item appears in the client's portal with an Approve
 * button (the existing pending-signoff mechanism), and the client gets an
 * email pointing at it. When they click Approve, the portal route calls
 * recordClientSignoff: the gate criterion is met, Ridhi is notified, and
 * SHE advances the pipeline — the agents never move a gated stage.
 */

export const SIGNOFF_PHASE = 'Final approval';

const requestedKey = (slug: string) => `signoffRequested:${slug}`;
const signedKey = (slug: string) => `signoffSigned:${slug}`;

export function signoffState(slug: string): { requested: string; signed: string } {
  return { requested: getState(requestedKey(slug)), signed: getState(signedKey(slug)) };
}

/** Comms duty: request sign-off from every approval-stage client, once. */
export async function signoffRequestDuty(): Promise<DutyResult> {
  const clients = await getAllClients();
  const due = clients.filter(
    (c) => c.active && c.pipeline === 'approval' && !getState(requestedKey(c.slug))
  );
  if (due.length === 0) {
    return { name: 'signoff-request', status: 'ok', summary: 'No approval-stage clients awaiting a sign-off request.' };
  }

  let sent = 0;
  for (const client of due) {
    // Skip if a sign-off item is already waiting (e.g. Ridhi added one by hand).
    const already = client.updates.some((u) => u.phase === SIGNOFF_PHASE && u.status === 'pending-signoff');
    if (!already) {
      appendUpdate(client.slug, {
        phase: SIGNOFF_PHASE,
        status: 'pending-signoff',
        notes:
          'The finished site is ready for your final review. Take a look at the staging link, and when everything is the way you want it, approve here to move to launch. Anything that still needs a tweak — just tell us in Messages instead.',
        date: new Date().toISOString().slice(0, 10),
      });
    }
    const emailed = await notifyClientOfSignoffRequest(client);
    // Phase 14: also trigger the Apps Script document engine's handoff step
    // (her Phase 3 — the "Final Approval & Handoff" doc + email) so no human
    // has to click the sheet menu. Signing THAT form flows back through the
    // handoff_signed webhook to the same recordClientSignoff below.
    const gas = await callGas(client.slug, 'send_handoff_doc', { email: client.email, name: client.name });
    appendLedger(client.slug, {
      agent: 'comms',
      kind: 'event',
      message: `Sign-off requested: "${SIGNOFF_PHASE}" is waiting in the client's portal with an Approve button.${emailed ? ' The client was emailed.' : ' No email went out (email not configured); the portal item is live.'}${gas.ok ? ' Apps Script handoff document triggered.' : ''}`,
      data: { emailed: String(emailed) },
    });
    setState(requestedKey(client.slug), new Date().toISOString());
    sent++;
  }
  return { name: 'signoff-request', status: 'ok', summary: `Sign-off requested from ${sent} client(s).` };
}

/**
 * Called by the portal-approve route when a client approves an update.
 * If it's the final-approval item on an approval-stage client, the gate
 * criterion is met BY the client's own action, so the pipeline advances to
 * payment automatically and the final invoice is drafted for Ridhi's
 * send-approval (amendment 2026-07-12: her human touches are internal
 * review and approving invoice sends).
 */
export async function recordClientSignoff(client: Client, phase: string): Promise<boolean> {
  if (client.pipeline !== 'approval' || phase !== SIGNOFF_PHASE) return false;
  if (getState(signedKey(client.slug))) return true; // already recorded
  const now = new Date().toISOString();
  setState(signedKey(client.slug), now);
  appendLedger(client.slug, {
    agent: 'comms',
    kind: 'decision',
    message: `CLIENT SIGNED OFF: ${client.name} approved "${phase}" from their portal — the final-approval gate criterion is met.`,
    data: { signedAt: now },
  });

  setPipelineStage(client.slug, 'payment');
  appendLedger(client.slug, {
    agent: 'comms',
    kind: 'handoff',
    message: 'Pipeline stage: Final approval → Payment (client sign-off received; advanced automatically).',
  });

  // Draft the final invoice right away rather than waiting for a heartbeat.
  const { proposeFinal, getProposedInvoices } = await import('./billing');
  const already = getProposedInvoices(client.slug).some((p) => p.kind === 'final' && p.status !== 'rejected');
  if (!already) await proposeFinal(client);
  return true;
}

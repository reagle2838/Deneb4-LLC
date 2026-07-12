import type { Client } from './clients';
import { getAllClients, appendUpdate } from './clients';
import { appendLedger } from './agent-ledger';
import { getState, setState } from './agent-state';
import { notifyClientOfSignoffRequest } from './notify';
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
    appendLedger(client.slug, {
      agent: 'comms',
      kind: 'event',
      message: `Sign-off requested: "${SIGNOFF_PHASE}" is waiting in the client's portal with an Approve button.${emailed ? ' The client was emailed.' : ' No email went out (email not configured); the portal item is live.'}`,
      data: { emailed: String(emailed) },
    });
    setState(requestedKey(client.slug), new Date().toISOString());
    sent++;
  }
  return { name: 'signoff-request', status: 'ok', summary: `Sign-off requested from ${sent} client(s).` };
}

/**
 * Called by the portal-approve route when a client approves an update.
 * If it's the final-approval item on an approval-stage client, record the
 * sign-off: the gate criterion is met, but only Ridhi advances the stage.
 */
export function recordClientSignoff(client: Client, phase: string): boolean {
  if (client.pipeline !== 'approval' || phase !== SIGNOFF_PHASE) return false;
  if (getState(signedKey(client.slug))) return true; // already recorded
  const now = new Date().toISOString();
  setState(signedKey(client.slug), now);
  appendLedger(client.slug, {
    agent: 'comms',
    kind: 'decision',
    message: `CLIENT SIGNED OFF: ${client.name} approved "${phase}" from their portal. The final-approval gate criterion is met — advance the pipeline to Payment when you're ready.`,
    data: { signedAt: now },
  });
  return true;
}

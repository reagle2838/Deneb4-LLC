import { getAllClients } from './clients';
import { appendLedger } from './agent-ledger';
import { getState, setState } from './agent-state';
import { notifyOwnerOfAgentAlert } from './notify';
import type { DutyResult } from './agent-roster';

/**
 * The Billing agent's Wave-less start (docs/agents.md: "automates the
 * sending and detecting, never the deciding"). Until Wave credentials
 * exist, invoices are the ones Ridhi records by hand in the portal
 * editor — this duty just watches them on payment-stage clients and
 * nudges her exactly once per condition:
 *
 * - at `payment` with NO invoice recorded  → she probably forgot to add it
 * - every invoice paid                     → the payment gate criterion is
 *   met; ready for handoff when she confirms
 *
 * Wave integration later replaces the manual marking; this shape stays.
 */

const nudgedKey = (slug: string, what: string) => `billingNudged:${slug}:${what}`;

export async function billingWatchDuty(): Promise<DutyResult> {
  const clients = await getAllClients();
  const atPayment = clients.filter((c) => c.active && c.pipeline === 'payment');
  if (atPayment.length === 0) {
    return { name: 'billing-watch', status: 'ok', summary: 'No clients at the payment stage.' };
  }

  let nudges = 0;
  let waiting = 0;
  for (const client of atPayment) {
    if (client.invoices.length === 0) {
      if (!getState(nudgedKey(client.slug, 'no-invoice'))) {
        const msg = `${client.name} is at the Payment stage but has no invoice recorded. Add the final invoice in their portal editor (Wave automation comes later; until then the record here is what Billing watches).`;
        appendLedger(client.slug, { agent: 'billing', kind: 'alert', message: msg });
        await notifyOwnerOfAgentAlert(client.slug, 'billing', msg);
        setState(nudgedKey(client.slug, 'no-invoice'), new Date().toISOString());
        nudges++;
      }
      continue;
    }

    const unpaid = client.invoices.filter((i) => i.status !== 'paid');
    if (unpaid.length === 0) {
      if (!getState(nudgedKey(client.slug, 'paid'))) {
        const msg = `${client.name}: every invoice is marked paid. The payment gate criterion is met — advance the pipeline to Handoff when you're ready.`;
        appendLedger(client.slug, { agent: 'billing', kind: 'decision', message: msg });
        await notifyOwnerOfAgentAlert(client.slug, 'billing', msg);
        setState(nudgedKey(client.slug, 'paid'), new Date().toISOString());
        nudges++;
      }
    } else {
      waiting++;
      // Overdue detection: a pending invoice past its due date, flagged once.
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
  }

  return {
    name: 'billing-watch',
    status: 'ok',
    summary: `${atPayment.length} at payment: ${nudges} nudge(s) sent, ${waiting} waiting on payment.`,
  };
}

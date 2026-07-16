/**
 * Outbound half of the Google Apps Script bridge (Phase 14).
 *
 * The inbound half has existed since Phase 11: Ridhi's Apps Script POSTs
 * its four lifecycle milestones to /api/agents/intake-webhook. This module
 * is the other direction — Deneb4 agents calling INTO the Apps Script
 * document engine, so pipeline moments (quote confirmed, build started,
 * final approval reached, fully paid) drive her Drive/Docs/Matrix
 * automation without a human relaying them.
 *
 * Dormant until both env vars are set:
 *   GAS_WEBAPP_URL      the Apps Script Web App /exec URL (deploy: "Anyone")
 *   GAS_SHARED_SECRET   matches DENEB4_BRIDGE_SECRET in Script Properties
 *
 * The doPost handler for the Apps Script side lives in docs/gas-bridge.md.
 * Never throws: a GAS hiccup must never break a Deneb4 pipeline step. Every
 * call is recorded on the client's ledger either way.
 */
import { appendLedger } from '@/lib/agent-ledger';

export type GasAction =
  | 'quote_approved' // Ridhi approved the quote; her side may notify/track
  | 'quote_confirmed' // client confirmed the quote
  | 'build_started' // deposit settled; the Builder is running
  | 'send_handoff_doc' // reached Final approval: trigger her Phase 3 doc + email
  | 'project_paid' // every invoice settled
  | 'project_complete'; // pipeline archived

export function gasEnabled(): boolean {
  return Boolean(process.env.GAS_WEBAPP_URL && process.env.GAS_SHARED_SECRET);
}

export async function callGas(
  slug: string,
  action: GasAction,
  payload: Record<string, unknown> = {}
): Promise<{ ok: boolean; detail: string }> {
  if (!gasEnabled()) {
    return { ok: false, detail: 'GAS bridge dormant (GAS_WEBAPP_URL / GAS_SHARED_SECRET unset).' };
  }
  try {
    const res = await fetch(process.env.GAS_WEBAPP_URL as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.GAS_SHARED_SECRET,
        action,
        slug,
        ...payload,
      }),
      // Apps Script web apps redirect to a one-time script.googleusercontent
      // URL; fetch must follow it for the response body.
      redirect: 'follow',
    });
    const ok = res.ok;
    const detail = ok ? `GAS accepted ${action}.` : `GAS returned ${res.status} for ${action}.`;
    appendLedger(slug, {
      agent: 'concierge',
      kind: 'event',
      message: `Apps Script bridge: ${detail}`,
    });
    return { ok, detail };
  } catch (err) {
    const detail = `GAS bridge call ${action} failed: ${err instanceof Error ? err.message : String(err)}`;
    appendLedger(slug, { agent: 'concierge', kind: 'event', message: detail });
    return { ok: false, detail };
  }
}

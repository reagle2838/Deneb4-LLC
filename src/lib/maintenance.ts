import { getAllClients } from './clients';
import { appendLedger } from './agent-ledger';
import { getState, setState } from './agent-state';
import { notifyOwnerOfAgentAlert } from './notify';
import type { DutyResult } from './agent-roster';

/**
 * The Maintenance agent's first duty (docs/agents.md: "widest blast
 * radius, tightest leash"). This is the SENSING half only: watch every
 * shipped/visible client site and tell Ridhi the moment one stops
 * answering — and when it recovers. It changes nothing.
 *
 * The ACTING half (dependency patching) is deliberately not on the
 * heartbeat: `npm run maintain -- <slug> --fix` runs it explicitly, with
 * the full QA battery and automatic git revert as the safety net.
 *
 * A site is watched when it has a staging/production URL recorded and its
 * status says it should be up ('ready' or 'live'). Two attempts before
 * declaring an outage, so a single network blip doesn't page anyone.
 */

const stateKey = (slug: string) => `uptime:${slug}`;

async function probe(url: string): Promise<{ up: boolean; detail: string }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal });
      if (res.status < 500) return { up: true, detail: `HTTP ${res.status}` };
      if (attempt === 2) return { up: false, detail: `HTTP ${res.status}` };
    } catch (err) {
      if (attempt === 2) return { up: false, detail: err instanceof Error ? err.message.split('\n')[0] : 'unreachable' };
    } finally {
      clearTimeout(t);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { up: false, detail: 'unreachable' };
}

export async function maintenanceWatchDuty(): Promise<DutyResult> {
  const clients = await getAllClients();
  const watched = clients.filter(
    (c) => c.active && c.staging.url && ['ready', 'live'].includes(c.staging.status)
  );
  if (watched.length === 0) {
    return { name: 'maintenance-watch', status: 'ok', summary: 'No live client URLs to watch yet.' };
  }

  let down = 0;
  let transitions = 0;
  for (const client of watched) {
    const url = /^https?:\/\//i.test(client.staging.url) ? client.staging.url : `https://${client.staging.url}`;
    const { up, detail } = await probe(url);
    const previous = getState(stateKey(client.slug)); // '' | 'up' | 'down'
    if (!up) down++;

    if (!up && previous !== 'down') {
      transitions++;
      const msg = `${client.name}'s site is DOWN (${url} — ${detail}). Checked twice before raising this.`;
      appendLedger(client.slug, { agent: 'maintenance', kind: 'alert', message: msg });
      await notifyOwnerOfAgentAlert(client.slug, 'maintenance', msg);
    } else if (up && previous === 'down') {
      transitions++;
      appendLedger(client.slug, {
        agent: 'maintenance',
        kind: 'event',
        message: `${client.name}'s site recovered (${url} — ${detail}).`,
      });
    }
    setState(stateKey(client.slug), up ? 'up' : 'down');
  }

  return {
    name: 'maintenance-watch',
    status: 'ok',
    summary: `${watched.length} site(s) checked: ${watched.length - down} up, ${down} down, ${transitions} state change(s).`,
  };
}

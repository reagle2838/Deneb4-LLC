import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { LEDGER_KINDS, type LedgerEntry, type LedgerKind } from './agent-roster';

/**
 * The shared agent ledger: the per-client space where the agents (and
 * Ridhi) communicate, hand work to each other, and leave a permanent
 * record of what happened on a project.
 *
 * One YAML file per channel in content/admin/agent-ledger/. A channel is
 * a client slug, or 'studio' for business-wide (non-client) traffic.
 * Server-only (fs): client components import from agent-roster instead.
 */

export { STUDIO_CHANNEL, AGENTS, LEDGER_KINDS } from './agent-roster';
export type { LedgerEntry, LedgerKind } from './agent-roster';

const LEDGER_DIR = path.join(process.cwd(), 'content', 'admin', 'agent-ledger');

export function isValidChannel(channel: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(channel);
}

function ledgerPath(channel: string): string {
  return path.join(LEDGER_DIR, `${channel}.yaml`);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseEntries(raw: unknown): LedgerEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((e) => ({
    id: str(e.id),
    date: str(e.date),
    agent: str(e.agent) || 'system',
    kind: (LEDGER_KINDS.includes(str(e.kind) as LedgerKind) ? str(e.kind) : 'event') as LedgerKind,
    message: str(e.message),
    data:
      e.data && typeof e.data === 'object'
        ? Object.fromEntries(
            Object.entries(e.data as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
          )
        : {},
  }));
}

/** All entries for one channel, oldest first. */
export function getLedger(channel: string): LedgerEntry[] {
  if (!isValidChannel(channel)) return [];
  const file = ledgerPath(channel);
  if (!fs.existsSync(file)) return [];
  try {
    return parseEntries(yamlLoad(fs.readFileSync(file, 'utf-8')));
  } catch {
    return [];
  }
}

/** Every channel's entries, keyed by channel name. */
export function getAllLedgers(): Record<string, LedgerEntry[]> {
  if (!fs.existsSync(LEDGER_DIR)) return {};
  const out: Record<string, LedgerEntry[]> = {};
  for (const f of fs.readdirSync(LEDGER_DIR)) {
    if (!f.endsWith('.yaml')) continue;
    const channel = f.replace(/\.yaml$/, '');
    out[channel] = getLedger(channel);
  }
  return out;
}

/** Append one entry (id + timestamp assigned here). Returns the entry. */
export function appendLedger(
  channel: string,
  entry: { agent: string; kind: LedgerKind; message: string; data?: Record<string, string> }
): LedgerEntry | null {
  if (!isValidChannel(channel)) return null;
  const full: LedgerEntry = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    agent: entry.agent,
    kind: entry.kind,
    message: entry.message,
    data: entry.data ?? {},
  };
  if (!fs.existsSync(LEDGER_DIR)) fs.mkdirSync(LEDGER_DIR, { recursive: true });
  const entries = [...getLedger(channel), full];
  fs.writeFileSync(ledgerPath(channel), yamlDump(entries, { lineWidth: -1, quotingType: '"' }), 'utf-8');
  return full;
}

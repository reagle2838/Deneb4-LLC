import fs from 'fs';
import path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

/**
 * Tiny durable key-value store for agent bookkeeping: dedup markers,
 * "last ran on this date" flags, and similar. Server-only.
 * One flat YAML map at content/admin/agent-state.yaml.
 */

const STATE_FILE = path.join(process.cwd(), 'content', 'admin', 'agent-state.yaml');

function readState(): Record<string, string> {
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    const data = yamlLoad(fs.readFileSync(STATE_FILE, 'utf-8'));
    if (!data || typeof data !== 'object') return {};
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
    );
  } catch {
    return {};
  }
}

export function getState(key: string): string {
  return readState()[key] ?? '';
}

export function setState(key: string, value: string): void {
  const state = readState();
  state[key] = value;
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, yamlDump(state, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

/** Today's date (YYYY-MM-DD) in the owner's timezone, for once-per-day guards. */
export function ownerToday(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  );
}

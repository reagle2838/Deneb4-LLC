import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

/**
 * Per-client cost ledger: the ACTUAL money spent delivering a project
 * (API usage, consultation calls, anything billable-to-the-business).
 * Costs feed the pricing floor and the profit line on the Billing panel —
 * they never appear on a client invoice. One YAML per client under
 * content/admin/costs/. Server-only.
 */

export type CostKind = 'build-api' | 'resend' | 'elevenlabs-call' | 'other';

export interface CostEntry {
  id: string;
  date: string; // ISO
  kind: CostKind;
  amount: number; // dollars
  note: string;
}

const COSTS_DIR = path.join(process.cwd(), 'content', 'admin', 'costs');
const costsPath = (slug: string) => path.join(COSTS_DIR, `${slug}.yaml`);

export function getCosts(slug: string): CostEntry[] {
  const file = costsPath(slug);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = yamlLoad(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(raw) ? (raw as CostEntry[]) : [];
  } catch {
    return [];
  }
}

// 4 decimal places, not 2: individual API calls (Haiku triage, extraction)
// can cost fractions of a cent. Rounding to whole cents would silently
// zero those out and understate real usage — the one thing this ledger
// must never do.
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function recordCost(slug: string, input: { kind: CostKind; amount: number; note?: string }): CostEntry | null {
  if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 10000) return null;
  const entry: CostEntry = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    kind: input.kind,
    amount: round4(input.amount),
    note: (input.note ?? '').slice(0, 300),
  };
  if (!fs.existsSync(COSTS_DIR)) fs.mkdirSync(COSTS_DIR, { recursive: true });
  fs.writeFileSync(costsPath(slug), yamlDump([...getCosts(slug), entry], { lineWidth: -1, quotingType: '"' }), 'utf-8');
  return entry;
}

export function totalCosts(slug: string): number {
  return round4(getCosts(slug).reduce((n, c) => n + c.amount, 0));
}

/** Number of 30-minute phone consultations held (drives final-invoice line items). */
export function consultationCount(slug: string): number {
  return getCosts(slug).filter((c) => c.kind === 'elevenlabs-call').length;
}

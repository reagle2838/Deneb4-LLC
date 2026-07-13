import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { recordCost } from './costs';
import { loadPricing } from './pricing';
import { appendLedger } from './agent-ledger';

/**
 * Consultation call records: what was actually SAID on a call, not just
 * what it cost. Logging a consultation writes three things at once so the
 * record never splits: the call record here (summary included), the real
 * cost entry (feeds the pricing floor), and a ledger event (feeds the
 * communications timeline). One YAML per client under
 * content/admin/consultations/. Server-only.
 *
 * When the ElevenLabs phone feature is eventually built, its transcript
 * summary lands in the same `summary` field through the same function —
 * the record shape doesn't change, only who writes it.
 */

export interface Consultation {
  id: string;
  date: string; // ISO
  durationMin: number;
  summary: string; // what was discussed / agreed / promised
  cost: number;
}

const DIR = path.join(process.cwd(), 'content', 'admin', 'consultations');
const filePath = (slug: string) => path.join(DIR, `${slug}.yaml`);

export function getConsultations(slug: string): Consultation[] {
  const file = filePath(slug);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = yamlLoad(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(raw) ? (raw as Consultation[]) : [];
  } catch {
    return [];
  }
}

export function logConsultation(
  slug: string,
  input: { durationMin?: number; summary: string }
): Consultation | null {
  const summary = input.summary.trim();
  if (!summary) return null; // a call with no record of what was said defeats the point
  const durationMin = Number.isFinite(input.durationMin) && input.durationMin! > 0 ? Math.min(input.durationMin!, 480) : 30;
  const pricing = loadPricing();
  // Cost scales with duration; the configured rate is per 30-minute session.
  const cost = Math.round(pricing.consultationCost * (durationMin / 30) * 100) / 100;

  const record: Consultation = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    durationMin,
    summary: summary.slice(0, 4000),
    cost,
  };
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(filePath(slug), yamlDump([...getConsultations(slug), record], { lineWidth: -1, quotingType: '"' }), 'utf-8');

  recordCost(slug, {
    kind: 'elevenlabs-call',
    amount: cost,
    note: `${durationMin}-min phone consultation (see consultation record ${record.id.slice(0, 8)})`,
  });
  appendLedger(slug, {
    agent: 'comms',
    kind: 'event',
    message: `Phone consultation (${durationMin} min): ${summary.length > 300 ? summary.slice(0, 297) + '...' : summary}`,
    data: { consultationId: record.id, durationMin: String(durationMin) },
  });
  return record;
}

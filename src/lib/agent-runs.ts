import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import type { AgentRun, DutyResult, DutyStatus } from './agent-roster';

/**
 * The agent-heartbeat run log: an observability record of every /api/agents/tick
 * run and how each duty fared. This is the "what happened at 2am" trail.
 * Server-only. Newest-last; capped at MAX_RUNS.
 */

export type { AgentRun, DutyResult, DutyStatus } from './agent-roster';

const RUNS_FILE = path.join(process.cwd(), 'content', 'admin', 'agent-runs.yaml');
const MAX_RUNS = 200;

const DUTY_STATUSES: DutyStatus[] = ['ok', 'skipped', 'error'];

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseRuns(raw: unknown): AgentRun[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((r) => ({
    id: str(r.id),
    date: str(r.date),
    trigger: str(r.trigger) || 'unknown',
    durationMs: typeof r.durationMs === 'number' ? r.durationMs : 0,
    duties: Array.isArray(r.duties)
      ? (r.duties as Record<string, unknown>[]).map((d) => ({
          name: str(d.name),
          status: (DUTY_STATUSES.includes(str(d.status) as DutyStatus) ? str(d.status) : 'ok') as DutyStatus,
          summary: str(d.summary),
        }))
      : [],
  }));
}

export function getRecentRuns(limit = 20): AgentRun[] {
  if (!fs.existsSync(RUNS_FILE)) return [];
  try {
    const all = parseRuns(yamlLoad(fs.readFileSync(RUNS_FILE, 'utf-8')));
    return all.slice(-limit).reverse(); // newest first for display
  } catch {
    return [];
  }
}

export function recordRun(input: { trigger: string; durationMs: number; duties: DutyResult[] }): AgentRun {
  const run: AgentRun = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    trigger: input.trigger,
    durationMs: input.durationMs,
    duties: input.duties,
  };
  let existing: AgentRun[] = [];
  if (fs.existsSync(RUNS_FILE)) {
    try {
      existing = parseRuns(yamlLoad(fs.readFileSync(RUNS_FILE, 'utf-8')));
    } catch {
      existing = [];
    }
  } else {
    fs.mkdirSync(path.dirname(RUNS_FILE), { recursive: true });
  }
  const next = [...existing, run].slice(-MAX_RUNS);
  fs.writeFileSync(RUNS_FILE, yamlDump(next, { lineWidth: -1, quotingType: '"' }), 'utf-8');
  return run;
}

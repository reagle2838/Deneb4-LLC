/**
 * Agent roster + ledger types. No Node dependencies, so this is safe to
 * import from client components (the fs-backed store lives in
 * agent-ledger.ts, server-only).
 */

export const STUDIO_CHANNEL = 'studio';

/** The working agent roster (ROADMAP Phase 5). Open-ended by design:
 * unknown agent ids still render, so new agents need no code change. */
export const AGENTS: Record<string, string> = {
  ridhi: 'Ridhi',
  system: 'System',
  concierge: 'Concierge',
  builder: 'Builder',
  qa: 'QA',
  comms: 'Comms',
  billing: 'Billing',
  maintenance: 'Maintenance',
};

export function agentLabel(id: string): string {
  return AGENTS[id] ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Unknown');
}

export const LEDGER_KINDS = ['message', 'event', 'handoff', 'alert', 'decision'] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export interface LedgerEntry {
  id: string;
  date: string; // ISO timestamp
  agent: string; // agent id ('builder', 'ridhi', ...)
  kind: LedgerKind;
  message: string;
  /** Small structured payload: refs, URLs, task ids. Strings only. */
  data: Record<string, string>;
}

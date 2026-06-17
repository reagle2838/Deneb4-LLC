import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

export type LeadStage = 'new' | 'contacted' | 'proposal' | 'won' | 'lost';
export const LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'proposal', 'won', 'lost'];

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  source: 'contact' | 'start';
  stage: LeadStage;
  message: string;
  createdAt: string;
}

const FILE = path.join(process.cwd(), 'content', 'admin', 'leads.yaml');

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function getLeads(): Lead[] {
  if (!fs.existsSync(FILE)) return [];
  try {
    const data = yamlLoad(fs.readFileSync(FILE, 'utf-8')) as { leads?: unknown } | null;
    const raw = Array.isArray(data?.leads) ? (data!.leads as unknown[]) : [];
    return raw.map((l) => {
      const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
      return {
        id: str(o.id) || crypto.randomUUID(),
        name: str(o.name),
        email: str(o.email),
        company: str(o.company),
        source: (str(o.source) === 'start' ? 'start' : 'contact') as Lead['source'],
        stage: (LEAD_STAGES.includes(str(o.stage) as LeadStage) ? str(o.stage) : 'new') as LeadStage,
        message: str(o.message),
        createdAt: str(o.createdAt),
      };
    });
  } catch {
    return [];
  }
}

export function writeLeads(leads: Lead[]): void {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, yamlDump({ leads }, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

/** Append a new lead from a form submission. Never throws. */
export function appendLead(input: {
  name: string;
  email: string;
  company?: string;
  source: 'contact' | 'start';
  message?: string;
}): void {
  try {
    const leads = getLeads();
    leads.unshift({
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      company: input.company ?? '',
      source: input.source,
      stage: 'new',
      message: input.message ?? '',
      createdAt: new Date().toISOString(),
    });
    writeLeads(leads);
  } catch {
    /* email is the primary channel; capture is best-effort */
  }
}

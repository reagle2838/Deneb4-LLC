/**
 * The quote gate (Phase 14, HITL touchpoint #1 of four).
 *
 * Flow: intake staged → quote drafts automatically → RIDHI approves or
 * denies WITH INSTRUCTIONS (deny is a feedback loop: the agent revises the
 * staged config / applies an adjustment per her notes and re-proposes, not
 * a dead end) → on her approval the CLIENT confirms (portal Approve item,
 * or a signed GAS Quote Authorization Form via the quote_signed webhook
 * event) → deposit invoice drafts for her send → deposit PAID is what
 * starts the build (billingWatchDuty).
 *
 * Store: content/admin/quotes/<slug>.json (tracked — quotes are business
 * records). Money math lives in pricing.ts; this module owns state.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { assertSafeSlug } from '@/lib/agent-auth';
import { computeQuoteForConfig, computeAnthropicCost, money, type Quote } from '@/lib/pricing';
import { recordCost } from '@/lib/costs';
import { appendLedger } from '@/lib/agent-ledger';

const QUOTES_DIR = path.join(process.cwd(), 'content', 'admin', 'quotes');
const INTAKE_DIR = path.join(process.cwd(), 'content', 'admin', 'intake');
const BUILD_CONFIGS_DIR = path.join(process.cwd(), 'content', 'build-configs');

/** Portal update phase for the client's confirmation item. */
export const QUOTE_PHASE = 'Quote approval';

export type QuoteStatus = 'pending_ridhi' | 'pending_client' | 'confirmed' | 'withdrawn';

export interface QuoteHistoryEntry {
  at: string;
  by: 'agent' | 'ridhi' | 'client';
  action: 'drafted' | 'revised' | 'approved' | 'denied' | 'confirmed' | 'withdrawn';
  note?: string;
}

export interface QuoteRecord {
  id: string;
  slug: string;
  status: QuoteStatus;
  quote: Quote;
  /** One-off adjustment from Ridhi's instructions (e.g. -200 for "$200 off"). */
  adjustmentUsd: number;
  adjustmentNote?: string;
  createdAt: string;
  updatedAt: string;
  history: QuoteHistoryEntry[];
}

function quotePath(slug: string): string {
  assertSafeSlug(slug);
  return path.join(QUOTES_DIR, `${slug}.json`);
}

export function getQuoteRecord(slug: string): QuoteRecord | null {
  const file = quotePath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as QuoteRecord;
  } catch {
    return null;
  }
}

function saveQuote(record: QuoteRecord): QuoteRecord {
  record.updatedAt = new Date().toISOString();
  fs.mkdirSync(QUOTES_DIR, { recursive: true });
  fs.writeFileSync(quotePath(record.slug), JSON.stringify(record, null, 2));
  return record;
}

/** Effective total after any Ridhi adjustment. */
export function quoteTotal(record: QuoteRecord): number {
  return Math.round((record.quote.total + record.adjustmentUsd) * 100) / 100;
}

// ── Config sources ────────────────────────────────────────────────────────

interface StagedIntake {
  config: { modules?: string[]; [k: string]: unknown };
  [k: string]: unknown;
}

function readStaged(slug: string): StagedIntake | null {
  assertSafeSlug(slug);
  const file = path.join(INTAKE_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as StagedIntake;
  } catch {
    return null;
  }
}

function currentConfig(slug: string): { cfg: { modules?: string[] }; source: 'applied' | 'staged' } | null {
  assertSafeSlug(slug);
  const applied = path.join(BUILD_CONFIGS_DIR, `${slug}.json`);
  if (fs.existsSync(applied)) {
    try {
      return { cfg: JSON.parse(fs.readFileSync(applied, 'utf-8')), source: 'applied' };
    } catch {
      /* fall through to staged */
    }
  }
  const staged = readStaged(slug);
  return staged?.config ? { cfg: staged.config, source: 'staged' } : null;
}

/**
 * Promote the staged intake config to the real build config. No-op when the
 * build config already exists (never clobbers an applied config — same
 * doctrine as `npm run intake -- --apply`). Returns what happened.
 */
export function applyStagedConfig(slug: string): 'applied' | 'already-applied' | 'no-staged-config' {
  assertSafeSlug(slug);
  const target = path.join(BUILD_CONFIGS_DIR, `${slug}.json`);
  if (fs.existsSync(target)) return 'already-applied';
  const staged = readStaged(slug);
  if (!staged?.config) return 'no-staged-config';
  fs.mkdirSync(BUILD_CONFIGS_DIR, { recursive: true });
  fs.writeFileSync(target, JSON.stringify(staged.config, null, 2));
  return 'applied';
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

/** Draft (or re-draft) the quote from the current config. */
export function draftQuote(slug: string, by: 'agent' | 'ridhi' = 'agent'): QuoteRecord | null {
  const source = currentConfig(slug);
  if (!source) return null;
  const quote = computeQuoteForConfig(slug, source.cfg);
  const existing = getQuoteRecord(slug);
  const record: QuoteRecord = existing ?? {
    id: crypto.randomUUID().slice(0, 8),
    slug,
    status: 'pending_ridhi',
    quote,
    adjustmentUsd: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
  };
  record.quote = quote;
  record.status = 'pending_ridhi';
  record.history.push({
    at: new Date().toISOString(),
    by,
    action: existing ? 'revised' : 'drafted',
    note: `Priced from the ${source.source} config: ${money(quote.total)}${record.adjustmentUsd ? ` ${record.adjustmentUsd > 0 ? '+' : ''}${money(record.adjustmentUsd)} adjustment` : ''}.`,
  });
  return saveQuote(record);
}

export function ridhiApproveQuote(slug: string): QuoteRecord | null {
  const record = getQuoteRecord(slug);
  if (!record || record.status !== 'pending_ridhi') return null;
  record.status = 'pending_client';
  record.history.push({ at: new Date().toISOString(), by: 'ridhi', action: 'approved' });
  return saveQuote(record);
}

export function clientConfirmQuote(slug: string): QuoteRecord | null {
  const record = getQuoteRecord(slug);
  if (!record || record.status !== 'pending_client') return null;
  record.status = 'confirmed';
  record.history.push({ at: new Date().toISOString(), by: 'client', action: 'confirmed' });
  return saveQuote(record);
}

// ── The deny-with-instructions feedback loop ─────────────────────────────

const MODULE_HINTS: [RegExp, string][] = [
  [/\b(careers?|jobs?|hiring|job board)\b/i, 'd4-careers-portal'],
  [/\b(blog|articles?|insights?|news)\b/i, 'd4-insights-blog'],
  [/\b(catalog|products?|inventory)\b/i, 'd4-catalog'],
  [/\b(gallery|photos?|pictures?|images?)\b/i, 'd4-gallery-editor'],
];
const REMOVE_VERB = /\b(remove|drop|delete|take (off|out)|without|no|cut|skip)\b/i;
const ADD_VERB = /\b(add|include|with|plus|enable)\b/i;
const DISCOUNT_RE = /(?:\$\s?(\d+(?:\.\d{1,2})?)\s*(?:off|discount|less|lower|down))|(?:(?:knock|take|discount)\s+(?:off\s+)?\$\s?(\d+(?:\.\d{1,2})?))/i;

interface RevisionPlan {
  addModules: string[];
  removeModules: string[];
  adjustmentUsd: number;
  understood: string[];
}

function heuristicRevision(instructions: string): RevisionPlan {
  const plan: RevisionPlan = { addModules: [], removeModules: [], adjustmentUsd: 0, understood: [] };
  // Sentence-level so "drop the blog, add a gallery" resolves both ways.
  for (const sentence of instructions.split(/[.;\n]+/)) {
    for (const [re, mod] of MODULE_HINTS) {
      if (!re.test(sentence)) continue;
      if (REMOVE_VERB.test(sentence)) {
        plan.removeModules.push(mod);
        plan.understood.push(`remove ${mod}`);
      } else if (ADD_VERB.test(sentence)) {
        plan.addModules.push(mod);
        plan.understood.push(`add ${mod}`);
      }
    }
  }
  const m = instructions.match(DISCOUNT_RE);
  if (m) {
    const amount = Number(m[1] ?? m[2]);
    if (Number.isFinite(amount) && amount > 0 && amount < 100000) {
      plan.adjustmentUsd = -amount;
      plan.understood.push(`${money(amount)} off`);
    }
  }
  return plan;
}

async function llmRevision(instructions: string, slug: string): Promise<RevisionPlan | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.COMMS_LLM_MODEL || 'claude-sonnet-5';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `You revise website quotes for a small studio. The owner denied a quote with these instructions:\n\n"${instructions}"\n\nRespond ONLY with JSON: {"addModules": string[], "removeModules": string[], "adjustmentUsd": number, "understood": string[]}. Modules must be from: d4-careers-portal, d4-insights-blog, d4-catalog, d4-gallery-editor. adjustmentUsd is a one-off dollar adjustment to the total (negative for a discount), 0 if none. "understood" is a short human list of what you did. If the instructions ask for anything else (pricing-book changes, custom work), leave arrays empty and adjustmentUsd 0.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: { text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    // Bill the call the instant usage arrives, before parsing can fail.
    if (data.usage) {
      const cost = computeAnthropicCost(model, data.usage.input_tokens ?? 0, data.usage.output_tokens ?? 0);
      recordCost(slug, { kind: 'build-api', amount: cost, note: `Quote revision (${model})` });
    }
    const text = data.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as RevisionPlan;
    const valid = ['d4-careers-portal', 'd4-insights-blog', 'd4-catalog', 'd4-gallery-editor'];
    return {
      addModules: (parsed.addModules ?? []).filter((mod) => valid.includes(mod)),
      removeModules: (parsed.removeModules ?? []).filter((mod) => valid.includes(mod)),
      adjustmentUsd:
        Number.isFinite(parsed.adjustmentUsd) && Math.abs(parsed.adjustmentUsd) < 100000 ? parsed.adjustmentUsd : 0,
      understood: (parsed.understood ?? []).map(String).slice(0, 10),
    };
  } catch {
    return null;
  }
}

function applyModulesToConfig(slug: string, add: string[], remove: string[]): boolean {
  // Prefer the applied config when it exists; otherwise revise the staged one.
  const appliedFile = path.join(BUILD_CONFIGS_DIR, `${slug}.json`);
  if (fs.existsSync(appliedFile)) {
    const cfg = JSON.parse(fs.readFileSync(appliedFile, 'utf-8'));
    const set = new Set<string>(cfg.modules ?? []);
    add.forEach((m) => set.add(m));
    remove.forEach((m) => set.delete(m));
    cfg.modules = [...set];
    fs.writeFileSync(appliedFile, JSON.stringify(cfg, null, 2));
    return true;
  }
  const staged = readStaged(slug);
  if (!staged?.config) return false;
  const set = new Set<string>(staged.config.modules ?? []);
  add.forEach((m) => set.add(m));
  remove.forEach((m) => set.delete(m));
  staged.config.modules = [...set];
  fs.writeFileSync(path.join(INTAKE_DIR, `${slug}.json`), JSON.stringify(staged, null, 2));
  return true;
}

/**
 * Ridhi denied the quote with instructions. The agent accommodates: module
 * adds/removes go into the config, a dollar adjustment goes onto the
 * record, and the quote re-drafts for her next look. Instructions the agent
 * can't map are said so plainly — never silently dropped.
 */
export async function ridhiDenyQuote(slug: string, instructions: string): Promise<QuoteRecord | null> {
  const record = getQuoteRecord(slug);
  if (!record || record.status !== 'pending_ridhi') return null;
  record.history.push({ at: new Date().toISOString(), by: 'ridhi', action: 'denied', note: instructions.slice(0, 500) });
  saveQuote(record);

  const plan = (await llmRevision(instructions, slug)) ?? heuristicRevision(instructions);

  const didModules =
    plan.addModules.length || plan.removeModules.length
      ? applyModulesToConfig(slug, plan.addModules, plan.removeModules)
      : false;
  if (plan.adjustmentUsd !== 0) {
    record.adjustmentUsd = Math.round(plan.adjustmentUsd * 100) / 100;
    record.adjustmentNote = instructions.slice(0, 200);
    saveQuote(record);
  }

  const revised = draftQuote(slug, 'agent');
  const understood = plan.understood.length ? plan.understood.join(', ') : null;
  appendLedger(slug, {
    agent: 'billing',
    kind: 'event',
    message: understood
      ? `Quote revised per your instructions (${understood})${didModules ? '; config updated' : ''}. New total ${money(quoteTotal(revised ?? record))} — awaiting your approval again.`
      : `Quote denial noted, but I could not map "${instructions.slice(0, 120)}" to module changes or a dollar adjustment. Edit the config or pricing.yaml directly, or rephrase (e.g. "remove the blog", "$200 off"), and the quote will re-draft.`,
  });
  return revised ?? record;
}

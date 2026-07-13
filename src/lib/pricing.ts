import fs from 'fs';
import path from 'path';
import { load as yamlLoad } from 'js-yaml';
import { totalCosts, consultationCount } from './costs';

// Read consultation records directly (consultations.ts imports this module,
// so importing it back would be a cycle). Billable sessions are 30-minute
// blocks: a 60-minute call is two sessions on the invoice.
function billableConsultationSessions(slug: string): number {
  const file = path.join(process.cwd(), 'content', 'admin', 'consultations', `${slug}.yaml`);
  if (!fs.existsSync(file)) return 0;
  try {
    const raw = yamlLoad(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(raw)) return 0;
    return (raw as { durationMin?: number }[]).reduce(
      (n, c) => n + Math.max(1, Math.ceil((c.durationMin ?? 30) / 30)),
      0
    );
  } catch {
    return 0;
  }
}

/**
 * The pricing engine: turns a client's build config into a quote with an
 * auditable cost floor. Two sides, per content/admin/pricing.yaml (which
 * Ridhi edits directly):
 *
 *   VALUE — the price book. The quote is built from it and it is also the
 *   ceiling: clients are never charged above book, so the price stays tied
 *   to what the deliverable is worth, not to what it cost us.
 *
 *   COST — monthly overhead (Claude + Google) amortized per client, plus
 *   per-project service costs (build API, Resend, ElevenLabs consultation
 *   calls; estimates until actuals land in the cost ledger).
 *
 * Guardrail: quote total must clear cost x minMarginMultiplier or Billing
 * alerts Ridhi instead of proceeding quietly. Billing split is 50% deposit
 * at build start, 50% balance at handoff (+ post-quote items like extra
 * consultations). Server-only.
 */

export interface ClaudeRate {
  input: number; // $ per million input tokens
  output: number; // $ per million output tokens
}

export interface PricingConfig {
  overheadMonthly: number;
  expectedClientsPerMonth: number;
  buildApiCostEstimate: number;
  resendCostEstimate: number;
  consultationCost: number;
  basePrice: number;
  modulePrices: Record<string, number>;
  catalogSeedOveragePerItem: number;
  consultationPrice: number;
  minMarginMultiplier: number;
  claudeRates: Record<string, ClaudeRate>;
  resendCostPerEmail: number;
  /** Client-facing: how to pay, shown in the portal Billing section. */
  paymentInstructions: string;
}

const DEFAULT_CLAUDE_RATES: Record<string, ClaudeRate> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 15, output: 75 },
};

const DEFAULTS: PricingConfig = {
  overheadMonthly: 50,
  expectedClientsPerMonth: 2,
  buildApiCostEstimate: 15,
  resendCostEstimate: 1,
  consultationCost: 8,
  basePrice: 2400,
  modulePrices: {
    'd4-careers-portal': 450,
    'd4-insights-blog': 400,
    'd4-catalog': 600,
    'd4-gallery-editor': 350,
  },
  catalogSeedOveragePerItem: 3,
  consultationPrice: 45,
  minMarginMultiplier: 3,
  claudeRates: DEFAULT_CLAUDE_RATES,
  resendCostPerEmail: 0.001,
  paymentInstructions: '',
};

const PRICING_FILE = path.join(process.cwd(), 'content', 'admin', 'pricing.yaml');
const BUILD_CONFIGS_DIR = path.join(process.cwd(), 'content', 'build-configs');

export function loadPricing(): PricingConfig {
  try {
    const raw = yamlLoad(fs.readFileSync(PRICING_FILE, 'utf-8')) as Partial<PricingConfig>;
    return {
      ...DEFAULTS,
      ...raw,
      modulePrices: { ...DEFAULTS.modulePrices, ...(raw.modulePrices ?? {}) },
      claudeRates: { ...DEFAULTS.claudeRates, ...(raw.claudeRates ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * The real $ cost of one Anthropic API call, from its actual token usage
 * and the model it ran on. Used to auto-log real costs the moment any
 * agent (Comms triage, content seeding) makes a call — replacing the
 * static buildApiCostEstimate with what a client's project actually used,
 * per model tier. Unknown models fall back to the haiku rate (the
 * cheapest reasonable assumption, so this never silently undercounts
 * toward zero for a model it doesn't recognize).
 */
export function computeAnthropicCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = loadPricing().claudeRates;
  const rate = rates[model] ?? rates['claude-haiku-4-5-20251001'] ?? DEFAULT_CLAUDE_RATES['claude-haiku-4-5-20251001'];
  const cost = (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
  return Math.round(cost * 10000) / 10000; // sub-cent precision; individual calls are tiny
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  total: number;
  deposit: number; // 50%, billed at build start
  balance: number; // 50%, billed at handoff (post-quote items are added to the final invoice separately)
  costFloor: number;
  costLines: QuoteLine[];
  marginMultiple: number; // total / costFloor
  marginOk: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MODULE_LABELS: Record<string, string> = {
  'd4-careers-portal': 'Careers page + applications',
  'd4-insights-blog': 'Blog / insights section',
  'd4-catalog': 'Product catalog (incl. up to 50 seeded items)',
  'd4-gallery-editor': 'Photo galleries',
};

/** Build the quote for a client from their build config + cost ledger. */
export function computeQuote(slug: string): Quote | null {
  const cfgFile = path.join(BUILD_CONFIGS_DIR, `${slug}.json`);
  if (!fs.existsSync(cfgFile)) return null;
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf-8')) as { modules?: string[] };
  const p = loadPricing();

  const lines: QuoteLine[] = [
    { label: 'Custom website: design, build, QA, staging, full ownership at handoff', amount: p.basePrice },
  ];
  for (const mod of cfg.modules ?? []) {
    const price = p.modulePrices[mod];
    if (price) lines.push({ label: MODULE_LABELS[mod] ?? mod, amount: price });
  }
  // Prefer duration-aware records; fall back to the cost-entry count for
  // clients logged before consultation records existed.
  const consults = billableConsultationSessions(slug) || consultationCount(slug);
  if (consults > 0) {
    lines.push({ label: `Phone consultations (${consults} × 30 min)`, amount: round2(consults * p.consultationPrice) });
  }
  const total = round2(lines.reduce((n, l) => n + l.amount, 0));

  // Cost floor: amortized overhead + service estimates + recorded actuals
  // beyond the estimates (actuals replace, not stack, the API estimate).
  const overheadShare = round2(p.overheadMonthly / Math.max(1, p.expectedClientsPerMonth));
  const actuals = totalCosts(slug);
  const estimated = p.buildApiCostEstimate + p.resendCostEstimate + consults * p.consultationCost;
  const services = Math.max(actuals, estimated);
  const costLines: QuoteLine[] = [
    { label: `Overhead share (Claude + Google, /${p.expectedClientsPerMonth} clients-mo)`, amount: overheadShare },
    {
      label: actuals > estimated ? 'Service costs (recorded actuals)' : 'Service costs (est: build API, email, calls)',
      amount: round2(services),
    },
  ];
  const costFloor = round2(overheadShare + services);
  const marginMultiple = costFloor > 0 ? round2(total / costFloor) : Infinity;

  return {
    lines,
    total,
    deposit: round2(total / 2),
    balance: round2(total - total / 2),
    costFloor,
    costLines,
    marginMultiple,
    marginOk: total >= costFloor * p.minMarginMultiplier,
  };
}

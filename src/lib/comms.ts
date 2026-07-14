import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import type { Client, ClientFeedback } from './clients';
import { getAllClients, addDraftReply } from './clients';
import { appendLedger } from './agent-ledger';
import { getState, setState } from './agent-state';
import { notifyOwnerOfAgentAlert } from './notify';
import { recordCost } from './costs';
import { computeAnthropicCost } from './pricing';
import { assertSafeSlug } from './agent-auth';
import type { DutyResult } from './agent-roster';

/**
 * The Comms agent (docs/agents.md): the client-facing voice. Triages new
 * client messages on its stages (client-review, approval), drafts replies
 * into the copy-review gate (draftReplies — Ridhi approves before anything
 * is sent), turns config-level change requests into structured change
 * proposals for the Builder (Ridhi approves before anything is applied),
 * and escalates everything else: structural asks, sign-off signals, upset
 * clients, and anything it cannot confidently classify. Escalation beats
 * improvisation.
 *
 * Deterministic by default. When ANTHROPIC_API_KEY is set, an LLM pass
 * takes over classification and reply drafting, but its output is clamped
 * through the same closed-menu validation, and every product still lands
 * behind Ridhi's gates. Server-only (fs).
 */

// ── Change proposals: what Comms hands the Builder, behind Ridhi's gate ──

/** Identity/theme fields a proposal may set. Mirrors the d4 build config. */
export const PATCHABLE_FIELDS = [
  'siteName',
  'tagline',
  'description',
  'contactEmail',
  'phone',
  'address',
  'themePreset',
] as const;
export type PatchableField = (typeof PATCHABLE_FIELDS)[number];

export const THEME_PRESETS = ['slate-teal', 'warm-sand', 'ink-indigo'];

/** The template's theme tokens; values are space-separated RGB channels. */
export const THEME_TOKENS = [
  '--accent',
  '--accent-strong',
  '--bg-base',
  '--bg-surface',
  '--text-heading',
  '--text-body',
  '--text-muted',
] as const;
const RGB_CHANNELS_RE = /^\d{1,3} \d{1,3} \d{1,3}$/;

export interface ConfigPatch {
  set?: Partial<Record<PatchableField, string>>;
  /** Full custom palette (brand ingestion); overrides themePreset. */
  theme?: Record<string, string>;
  addModules?: string[];
  removeModules?: string[];
}

export interface ChangeProposal {
  id: string;
  status: 'proposed' | 'applied' | 'rejected';
  summary: string;
  patch: ConfigPatch;
  sourceMessageIds: string[];
  createdBy: string;
  date: string;
  resolvedDate?: string;
  note?: string;
}

const PROPOSALS_DIR = path.join(process.cwd(), 'content', 'admin', 'change-proposals');
const BUILD_CONFIGS_DIR = path.join(process.cwd(), 'content', 'build-configs');
const REGISTRY_FILE = path.join(process.cwd(), 'vendor', 'd4', 'd4-site-builder', 'registry.json');

// Fallback if the local d4 mirror hasn't been cloned yet (registry.json is
// the operational source of truth; this list mirrors it).
const FALLBACK_MODULES = [
  'd4-cms-core',
  'd4-careers-portal',
  'd4-insights-blog',
  'd4-catalog',
  'd4-gallery-editor',
];

/** The closed menu: selectable module names from the d4 registry. */
export function selectableModules(): string[] {
  try {
    const reg = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) as {
      modules?: { name?: string; alwaysIncluded?: boolean }[];
    };
    const names = (reg.modules ?? [])
      .filter((m) => m.name && !m.alwaysIncluded)
      .map((m) => m.name as string);
    if (names.length > 0) return names;
  } catch {
    /* fall through */
  }
  return FALLBACK_MODULES;
}

export function hasBuildConfig(slug: string): boolean {
  return fs.existsSync(path.join(BUILD_CONFIGS_DIR, `${assertSafeSlug(slug)}.json`));
}

/**
 * Clamp a raw patch to the closed menu. Unknown fields, unknown modules,
 * and invalid presets are DROPPED and reported, never passed through.
 */
export function sanitizePatch(raw: unknown): { patch: ConfigPatch; dropped: string[] } {
  const dropped: string[] = [];
  const patch: ConfigPatch = {};
  if (!raw || typeof raw !== 'object') return { patch, dropped };
  const r = raw as Record<string, unknown>;
  const menu = selectableModules();

  if (r.set && typeof r.set === 'object') {
    const set: ConfigPatch['set'] = {};
    for (const [k, v] of Object.entries(r.set as Record<string, unknown>)) {
      const value = typeof v === 'string' ? v.trim() : '';
      if (!PATCHABLE_FIELDS.includes(k as PatchableField) || !value) {
        dropped.push(`set.${k}`);
        continue;
      }
      if (k === 'themePreset' && !THEME_PRESETS.includes(value)) {
        dropped.push(`themePreset "${value}" (not a preset)`);
        continue;
      }
      set[k as PatchableField] = value.slice(0, 500);
    }
    if (Object.keys(set).length) patch.set = set;
  }
  if (r.theme && typeof r.theme === 'object') {
    const theme: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.theme as Record<string, unknown>)) {
      const value = typeof v === 'string' ? v.trim() : '';
      if (!(THEME_TOKENS as readonly string[]).includes(k)) {
        dropped.push(`theme ${k} (not a theme token)`);
        continue;
      }
      if (!RGB_CHANNELS_RE.test(value) || value.split(' ').some((c) => Number(c) > 255)) {
        dropped.push(`theme ${k} "${value}" (not "R G B" channels)`);
        continue;
      }
      theme[k] = value;
    }
    // A partial palette would leave the site half-themed; all or nothing.
    if (Object.keys(theme).length === THEME_TOKENS.length) patch.theme = theme;
    else if (Object.keys(theme).length > 0) dropped.push(`theme (incomplete: ${Object.keys(theme).length}/${THEME_TOKENS.length} tokens)`);
  }
  for (const key of ['addModules', 'removeModules'] as const) {
    if (!Array.isArray(r[key])) continue;
    const ok = (r[key] as unknown[]).filter((m): m is string => typeof m === 'string' && menu.includes(m));
    const bad = (r[key] as unknown[]).filter((m) => typeof m !== 'string' || !menu.includes(m));
    for (const b of bad) dropped.push(`${key}: ${String(b)} (off the menu)`);
    if (ok.length) patch[key] = [...new Set(ok)];
  }
  return { patch, dropped };
}

export function patchIsEmpty(patch: ConfigPatch): boolean {
  return !patch.set && !patch.theme && !patch.addModules?.length && !patch.removeModules?.length;
}

/** Human-readable one-liner for a patch (ledger + client-facing draft). */
export function describePatch(patch: ConfigPatch): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(patch.set ?? {})) {
    parts.push(`${k} → "${v.length > 60 ? v.slice(0, 57) + '...' : v}"`);
  }
  if (patch.theme) parts.push('custom brand palette (7 theme tokens)');
  if (patch.addModules?.length) parts.push(`add ${patch.addModules.join(', ')}`);
  if (patch.removeModules?.length) parts.push(`remove ${patch.removeModules.join(', ')}`);
  return parts.join('; ');
}

function proposalsPath(slug: string): string {
  return path.join(PROPOSALS_DIR, `${assertSafeSlug(slug)}.yaml`);
}

export function getProposals(slug: string): ChangeProposal[] {
  const file = proposalsPath(slug);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = yamlLoad(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(raw) ? (raw as ChangeProposal[]) : [];
  } catch {
    return [];
  }
}

function writeProposals(slug: string, proposals: ChangeProposal[]): void {
  if (!fs.existsSync(PROPOSALS_DIR)) fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
  fs.writeFileSync(proposalsPath(slug), yamlDump(proposals, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

export function addProposal(
  slug: string,
  input: { patch: ConfigPatch; summary?: string; sourceMessageIds?: string[]; createdBy?: string }
): ChangeProposal | null {
  if (patchIsEmpty(input.patch)) return null;
  const proposal: ChangeProposal = {
    id: crypto.randomUUID(),
    status: 'proposed',
    summary: input.summary || describePatch(input.patch),
    patch: input.patch,
    sourceMessageIds: input.sourceMessageIds ?? [],
    createdBy: input.createdBy || 'comms',
    date: new Date().toISOString(),
  };
  writeProposals(slug, [...getProposals(slug), proposal]);
  return proposal;
}

export function resolveProposal(
  slug: string,
  id: string,
  status: 'applied' | 'rejected',
  note?: string
): ChangeProposal | null {
  const proposals = getProposals(slug);
  const target = proposals.find((p) => p.id === id && p.status === 'proposed');
  if (!target) return null;
  target.status = status;
  target.resolvedDate = new Date().toISOString();
  if (note) target.note = note;
  writeProposals(slug, proposals);
  return target;
}

/**
 * Apply an approved patch to the client's build config on disk. Modules
 * keep their existing order; additions append. Returns what changed, or
 * null if the config file doesn't exist.
 */
export function applyPatchToBuildConfig(slug: string, patch: ConfigPatch): string | null {
  const file = path.join(BUILD_CONFIGS_DIR, `${assertSafeSlug(slug)}.json`);
  if (!fs.existsSync(file)) return null;
  const cfg = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch.set ?? {})) cfg[k] = v;
  if (patch.theme) {
    cfg.theme = patch.theme;
    // A custom palette supersedes the preset; leaving both would be ambiguous.
    delete cfg.themePreset;
  }
  if (patch.addModules?.length || patch.removeModules?.length) {
    const modules = Array.isArray(cfg.modules) ? (cfg.modules as string[]) : [];
    const removed = new Set(patch.removeModules ?? []);
    const next = modules.filter((m) => !removed.has(m));
    for (const m of patch.addModules ?? []) if (!next.includes(m)) next.push(m);
    cfg.modules = next;
  }
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
  return describePatch(patch);
}

export function countPendingProposals(slug: string): number {
  return getProposals(slug).filter((p) => p.status === 'proposed').length;
}

// ── Triage ────────────────────────────────────────────────────────────────

export type TriageCategory =
  | 'change-request'
  | 'question'
  | 'structural'
  | 'approval'
  | 'consultation'
  | 'urgent'
  | 'unclear';

export interface BatchTriage {
  perMessage: { id: string; category: TriageCategory; reason: string }[];
  patch: ConfigPatch;
  draftReply: string;
  /** 'heuristic' or the LLM model id that produced the triage. */
  engine: string;
}

const MODULE_HINTS: [RegExp, string][] = [
  [/\b(careers?|jobs?|hiring|job board|job postings?|apply|applications?)\b/i, 'd4-careers-portal'],
  [/\b(blog|articles?|insights?|news( section)?|posts?)\b/i, 'd4-insights-blog'],
  [/\b(catalog|products?|equipment list|parts? list|inventory)\b/i, 'd4-catalog'],
  [/\b(gallery|photos?|pictures?|images? (section|page))\b/i, 'd4-gallery-editor'],
];
const ADD_VERB = /\b(add|include|enable|turn on|set up|we (want|need)|can (we|you) (add|get|have)|i('d| would) (like|love))\b/i;
const REMOVE_VERB = /\b(remove|drop|delete|take (off|down|out)|turn off|get rid of|don'?t (want|need))\b/i;
const URGENT_RE = /\b(unacceptable|very disappointed|frustrat|angry|upset|furious|refund|cancel (the|my|this|our)|lawyer|legal action|terrible|awful|worst)\b/i;
const APPROVAL_RE = /\b(approved?|looks? (great|good|perfect)|lgtm|sign(ed|ing)? ?off|good to go|ready to (go|launch|ship)|love it|ship it|we'?re happy|no (more )?changes)\b/i;
// Checked before STRUCTURAL_RE, whose /schedul\w*/ would otherwise claim these.
const CONSULTATION_RE = /\b(consultation|phone call|call me|give (me|us) a call|speak (with|to) you|talk (on the|by) phone|schedule a (call|chat|meeting)|hop on a call)\b/i;
const STRUCTURAL_RE = /\b(new page|custom|animation|redesign|rebuild|different layout|integrat\w*|shopify|e-?commerce|online store|checkout|payment|booking|schedul\w*|calculator|configurator|map|multilingual|translat\w*|login for|portal for|search)\b/i;
const QUESTION_RE = /\?|^\s*(when|what|how|why|where|who|can|could|will|would|is|are|do|does|should)\b/i;

/** Pull "<field> to <value>" style requests out of one message. */
function extractSetRequests(text: string): NonNullable<ConfigPatch['set']> {
  const set: NonNullable<ConfigPatch['set']> = {};
  const grab = (re: RegExp): string | undefined => {
    const m = text.match(re);
    const v = m?.[m.length - 1]?.trim().replace(/^["'“]|["'”.]+$/g, '');
    return v || undefined;
  };
  const tagline = grab(/\b(?:change|update|set|make)\s+(?:the\s+)?tagline\s+to\s+[:\-]?\s*["'“]?([^"'”\n]+)["'”]?/i);
  if (tagline) set.tagline = tagline;
  const phone = grab(/\b(?:change|update|set|correct)\s+(?:the\s+)?(?:phone(?:\s+number)?|number)\s+to\s+[:\-]?\s*([\d()\-. +]{7,25})/i);
  if (phone) set.phone = phone.trim();
  const email = grab(/\b(?:change|update|set)\s+(?:the\s+)?(?:contact\s+)?email\s+to\s+[:\-]?\s*([^\s"']+@[^\s"']+\.[a-z]{2,})/i);
  if (email) set.contactEmail = email;
  const address = grab(/\b(?:change|update|set)\s+(?:the\s+)?address\s+to\s+[:\-]?\s*["'“]?([^"'”\n]+)["'”]?/i);
  if (address) set.address = address;
  const theme = text.match(/\b(?:switch|change|set)\s+(?:the\s+)?(?:theme|colou?rs?(?:\s+scheme)?)\s+to\s+["'“]?(slate-teal|warm-sand|ink-indigo)["'”]?/i);
  if (theme) set.themePreset = theme[1].toLowerCase();
  return set;
}

function extractModuleRequests(text: string): { add: string[]; remove: string[] } {
  const add: string[] = [];
  const remove: string[] = [];
  // Sentence-level so "add a blog" and "remove the gallery" in one message
  // don't cross-contaminate verbs.
  for (const sentence of text.split(/(?<=[.!?\n])\s+/)) {
    for (const [re, mod] of MODULE_HINTS) {
      if (!re.test(sentence)) continue;
      if (REMOVE_VERB.test(sentence)) remove.push(mod);
      else if (ADD_VERB.test(sentence)) add.push(mod);
    }
  }
  return { add: [...new Set(add)], remove: [...new Set(remove)] };
}

/** Deterministic triage of one message. */
function heuristicTriageOne(m: ClientFeedback, configAvailable: boolean): {
  category: TriageCategory;
  reason: string;
  patch: ConfigPatch;
} {
  const text = m.message;
  if (URGENT_RE.test(text)) {
    return { category: 'urgent', reason: 'Tone suggests the client is upset; Ridhi should reply personally.', patch: {} };
  }
  if (CONSULTATION_RE.test(text)) {
    return {
      category: 'consultation',
      reason: 'Wants a phone consultation — scheduling is yours; log the call summary in Billing afterward.',
      patch: {},
    };
  }
  if (configAvailable) {
    const set = extractSetRequests(text);
    const mods = extractModuleRequests(text);
    const patch: ConfigPatch = {};
    if (Object.keys(set).length) patch.set = set;
    if (mods.add.length) patch.addModules = mods.add;
    if (mods.remove.length) patch.removeModules = mods.remove;
    if (!patchIsEmpty(patch)) {
      return { category: 'change-request', reason: `Config-level: ${describePatch(patch)}.`, patch };
    }
  }
  if (STRUCTURAL_RE.test(text)) {
    return { category: 'structural', reason: 'Asks for something off the module menu; needs Ridhi + Cowork.', patch: {} };
  }
  if (APPROVAL_RE.test(text) && !REMOVE_VERB.test(text) && !ADD_VERB.test(text)) {
    return { category: 'approval', reason: 'Reads like sign-off; Ridhi confirms before anything advances.', patch: {} };
  }
  if (QUESTION_RE.test(text)) {
    return { category: 'question', reason: 'A question; drafted an acknowledgment for Ridhi to complete.', patch: {} };
  }
  return { category: 'unclear', reason: 'Could not classify confidently; flagged for Ridhi.', patch: {} };
}

/** Compose the single per-batch draft reply (never sent without approval). */
function composeDraft(perMessage: BatchTriage['perMessage'], patch: ConfigPatch): string {
  const cats = new Set(perMessage.map((p) => p.category));
  const parts: string[] = [];
  if (!patchIsEmpty(patch)) {
    parts.push(
      `Thanks for the notes! We've queued the following change${describePatch(patch).includes(';') ? 's' : ''}: ${describePatch(patch)}. You'll see it on the staging site shortly after it clears our checks, and we'll confirm here when it's up.`
    );
  }
  if (cats.has('consultation')) {
    parts.push(`Happy to get on a call — we'll follow up here shortly to set a time that works for you.`);
  }
  if (cats.has('structural')) {
    parts.push(
      `Part of what you asked for goes beyond a quick settings change, so we're looking at the best way to do it properly and will come back to you with options.`
    );
  }
  if (cats.has('question')) {
    parts.push(`On your question — good one. We're checking and will get back to you here shortly.`);
  }
  return parts.join('\n\n');
}

function heuristicTriage(messages: ClientFeedback[], configAvailable: boolean): BatchTriage {
  const perMessage: BatchTriage['perMessage'] = [];
  const merged: ConfigPatch = {};
  for (const m of messages) {
    const t = heuristicTriageOne(m, configAvailable);
    perMessage.push({ id: m.id, category: t.category, reason: t.reason });
    if (t.patch.set) merged.set = { ...merged.set, ...t.patch.set };
    if (t.patch.addModules) merged.addModules = [...new Set([...(merged.addModules ?? []), ...t.patch.addModules])];
    if (t.patch.removeModules) merged.removeModules = [...new Set([...(merged.removeModules ?? []), ...t.patch.removeModules])];
  }
  return { perMessage, patch: merged, draftReply: composeDraft(perMessage, merged), engine: 'heuristic' };
}

// ── LLM seam (key-gated; output clamped through the same validators) ─────

// This call drafts client-facing prose (the reply) as well as classifying,
// so it defaults to Sonnet rather than Haiku: low volume (only fires on new
// messages from comms-stage clients) and quality matters more here than in
// bulk extraction — see seed-content.mjs's model choice for the contrast.
// Override with COMMS_LLM_MODEL. Every call's real token cost is measured
// and logged automatically (computeAnthropicCost below), never guessed.
const LLM_MODEL = process.env.COMMS_LLM_MODEL || 'claude-sonnet-5';

async function llmTriage(
  messages: ClientFeedback[],
  client: Client,
  configAvailable: boolean
): Promise<BatchTriage | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const menu = selectableModules();
  const system = [
    `You triage client feedback for a web design studio. The client "${client.name}" is reviewing their staging site.`,
    `Classify each message as one of: change-request, question, structural, approval, consultation (wants a phone call), urgent, unclear.`,
    `A change-request maps ONLY onto this closed menu — identity fields ${PATCHABLE_FIELDS.join(', ')} (themePreset must be one of ${THEME_PRESETS.join(', ')}) and modules ${menu.join(', ')}. Anything else a client wants changed is "structural".`,
    configAvailable ? '' : 'This client has no build config yet, so nothing is a change-request; use structural or question.',
    `Rules for draftReply (a single reply to the whole batch, drafted for the studio owner to approve; it is NEVER sent automatically):`,
    `- Never state a fact the client did not supply. No prices, dates, or commitments beyond "queued" / "reviewing".`,
    `- Warm, plain, professional. Under 120 words. Empty string if every message is approval or urgent (the owner replies personally).`,
    `Respond with ONLY a JSON object: {"perMessage":[{"id","category","reason"}], "patch":{"set":{...},"addModules":[],"removeModules":[]}, "draftReply":"..."} — patch may be {}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const user = messages
    .map((m) => `Message id=${m.id}${m.page ? ` (about page: ${m.page})` : ''}:\n${m.message}`)
    .join('\n\n---\n\n');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    // Log the REAL cost of this call the moment it's known — before any
    // parsing below can fail — so actual usage always reaches the cost
    // ledger, whether or not the response turns out to be usable.
    if (data.usage) {
      const cost = computeAnthropicCost(LLM_MODEL, data.usage.input_tokens ?? 0, data.usage.output_tokens ?? 0);
      if (cost > 0) {
        recordCost(client.slug, {
          kind: 'build-api',
          amount: cost,
          note: `Comms triage (${LLM_MODEL}): ${data.usage.input_tokens ?? 0} in / ${data.usage.output_tokens ?? 0} out tokens.`,
        });
      }
    }

    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const jsonText = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonText) as {
      perMessage?: { id?: string; category?: string; reason?: string }[];
      patch?: unknown;
      draftReply?: string;
    };

    const validIds = new Set(messages.map((m) => m.id));
    const validCats: TriageCategory[] = ['change-request', 'question', 'structural', 'approval', 'consultation', 'urgent', 'unclear'];
    const perMessage: BatchTriage['perMessage'] = [];
    for (const p of parsed.perMessage ?? []) {
      if (!p.id || !validIds.has(p.id)) continue;
      const category = validCats.includes(p.category as TriageCategory) ? (p.category as TriageCategory) : 'unclear';
      perMessage.push({ id: p.id, category, reason: (p.reason ?? '').slice(0, 300) });
    }
    // Every message must be covered, or we don't trust the result.
    if (perMessage.length !== messages.length) throw new Error('LLM triage did not cover every message.');

    const { patch } = sanitizePatch(parsed.patch);
    const draftReply = typeof parsed.draftReply === 'string' ? parsed.draftReply.trim().slice(0, 1500) : '';
    return { perMessage, patch, draftReply, engine: LLM_MODEL };
  } catch (err) {
    console.error('[deneb4] comms LLM triage failed, falling back to heuristics:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── The duty (called from /api/agents/tick) ──────────────────────────────

// Triage runs for every active client, whatever the stage: a consultation
// request during handoff or an upset message during payment deserves the
// same treatment as one during client review. Safe to widen because triage
// never sends or applies anything — its products (drafts, proposals) stay
// behind Ridhi's gates, and the Builder separately refuses ineligible
// stages when a proposal is approved.
const TRIAGED_CAP = 400;

function triagedIds(slug: string): string[] {
  try {
    const raw = getState(`commsTriaged:${slug}`);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function markTriaged(slug: string, ids: string[]): void {
  const next = [...triagedIds(slug), ...ids].slice(-TRIAGED_CAP);
  setState(`commsTriaged:${slug}`, JSON.stringify(next));
}

const excerpt = (s: string) => (s.length > 90 ? s.slice(0, 87) + '...' : s).replace(/\s+/g, ' ');

/**
 * Triage every new client message on Comms's stages. Products per client:
 * one ledger triage summary, at most one draft reply (copy gate), at most
 * one change proposal (change gate), and alert escalations for urgent /
 * structural / sign-off signals. Never advances the pipeline, never sends
 * anything to the client, never edits a build config.
 */
export async function commsTriageDuty(): Promise<DutyResult> {
  const clients = await getAllClients();
  const eligible = clients.filter((c) => c.active && c.pipeline !== '');
  let triaged = 0;
  let drafts = 0;
  let proposals = 0;
  let alerts = 0;

  for (const client of eligible) {
    const seen = new Set(triagedIds(client.slug));
    const fresh = client.feedback
      .filter((m) => m.author === 'client' && !m.resolved && !seen.has(m.id))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (fresh.length === 0) continue;

    const configAvailable = hasBuildConfig(client.slug);
    const triage = (await llmTriage(fresh, client, configAvailable)) ?? heuristicTriage(fresh, configAvailable);
    // The LLM path is clamped too, but sanitize once more at the boundary.
    const { patch } = sanitizePatch(triage.patch);

    // 1. Change proposal (Ridhi approves before the config is touched).
    let proposal: ChangeProposal | null = null;
    if (!patchIsEmpty(patch) && configAvailable) {
      const sourceIds = triage.perMessage.filter((p) => p.category === 'change-request').map((p) => p.id);
      proposal = addProposal(client.slug, { patch, sourceMessageIds: sourceIds, createdBy: 'comms' });
      if (proposal) proposals++;
    }

    // 2. Draft reply (Ridhi approves before the client sees it).
    if (triage.draftReply.trim()) {
      const pages = [...new Set(fresh.map((m) => m.page).filter(Boolean))];
      addDraftReply(client.slug, {
        message: triage.draftReply.trim(),
        page: pages.length === 1 ? pages[0] : '',
        createdBy: 'comms',
      });
      drafts++;
    }

    // 3. Triage summary on the client's channel.
    const lines = triage.perMessage.map((p) => {
      const msg = fresh.find((m) => m.id === p.id);
      return `- [${p.category}] "${excerpt(msg?.message ?? '')}" — ${p.reason}`;
    });
    appendLedger(client.slug, {
      agent: 'comms',
      kind: 'event',
      message:
        `Triaged ${fresh.length} new client message${fresh.length === 1 ? '' : 's'}.\n${lines.join('\n')}` +
        (proposal ? `\nProposed change awaiting your approval: ${proposal.summary}.` : '') +
        (triage.draftReply.trim() ? `\nDraft reply queued for your approval in Messages.` : ''),
      data: { engine: triage.engine, messages: String(fresh.length) },
    });

    // 4. Escalations (alert + email; the alert-and-stop rule).
    const needsRidhi = triage.perMessage.filter((p) =>
      ['urgent', 'structural', 'approval', 'consultation', 'unclear'].includes(p.category)
    );
    if (needsRidhi.length > 0) {
      const detail = needsRidhi
        .map((p) => {
          const msg = fresh.find((m) => m.id === p.id);
          return `[${p.category}] "${excerpt(msg?.message ?? '')}" — ${p.reason}`;
        })
        .join('\n');
      appendLedger(client.slug, {
        agent: 'comms',
        kind: 'alert',
        message: `${needsRidhi.length} message${needsRidhi.length === 1 ? ' needs' : 's need'} you:\n${detail}`,
        data: { categories: [...new Set(needsRidhi.map((p) => p.category))].join(',') },
      });
      await notifyOwnerOfAgentAlert(
        client.slug,
        'comms',
        `${client.name}: ${needsRidhi.length} message${needsRidhi.length === 1 ? ' needs' : 's need'} you.\n${detail}`
      );
      alerts++;
    }

    markTriaged(client.slug, fresh.map((m) => m.id));
    triaged += fresh.length;
  }

  if (triaged === 0) {
    return { name: 'comms-triage', status: 'ok', summary: `No new client messages across ${eligible.length} active client(s).` };
  }
  return {
    name: 'comms-triage',
    status: 'ok',
    summary: `Triaged ${triaged} message(s): ${drafts} draft(s), ${proposals} change proposal(s), ${alerts} escalation(s).`,
  };
}

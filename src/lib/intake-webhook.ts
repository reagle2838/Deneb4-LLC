import path from 'path';
import fs from 'fs';
import {
  slugify,
  clientExists,
  writeClient,
  getClientBySlug,
  setDriveFolderIfEmpty,
  EMPTY_STAGING,
  generateWidgetKey,
  type Client,
} from './clients';
import { generateClientPassword, hashPassword } from './portal-auth';
import { appendLedger } from './agent-ledger';
import { notifyOwnerOfAgentAlert } from './notify';
import { setPipelineStage } from './clients';
import { recordClientSignoff, SIGNOFF_PHASE } from './signoff';
import { draftQuote, quoteTotal } from './quotes';
import { money } from './pricing';

/**
 * The live bridge from Ridhi's Google Workspace automation (a Google Form
 * → Apps Script pipeline she built and runs herself) into the Deneb4
 * pipeline. Her spreadsheet ("Deneb4 Project Matrix") is a coarse,
 * bird's-eye status tracker; this keeps the Workspace's granular pipeline
 * stage in sync with her four real milestones, WITHOUT taking over her
 * mechanism — her scope-doc and handoff-doc e-signatures stay the actual
 * approval instruments. This module only records what already happened.
 *
 * Mirrors scripts/parse-intake.mjs's Q-code mapping (Q3-1, Q7A-1, ...) —
 * same codes, same decisions, ported to read from Apps Script's
 * e.namedValues object shape instead of a CSV row. If the form's codes
 * change, update BOTH files.
 */

const INTAKE_DIR = path.join(process.cwd(), 'content', 'admin', 'intake');
const BUILD_CONFIGS_DIR = path.join(process.cwd(), 'content', 'build-configs');

// ── Q-code reading over an Apps Script namedValues-shaped object ────────
type Responses = Record<string, string[] | string | undefined>;

function flatten(v: string[] | string | undefined): string {
  if (v == null) return '';
  return (Array.isArray(v) ? v.join(', ') : v).trim();
}

function makeReader(responses: Responses) {
  const keys = Object.keys(responses);
  return (code: string, hint?: RegExp): { value: string; how: 'code' | 'fuzzy' | 'none' } => {
    const codeRe = new RegExp('^' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[.\\s:)\\-]|$)', 'i');
    let key = keys.find((k) => codeRe.test(k));
    if (key) return { value: flatten(responses[key]), how: 'code' };
    if (hint) {
      key = keys.find((k) => hint.test(k));
      if (key) return { value: flatten(responses[key]), how: 'fuzzy' };
    }
    return { value: '', how: 'none' };
  };
}

const isYes = (v: string) => /^yes\b/i.test(v.trim());
const isUnsure = (v: string) => /not sure|unsure|maybe/i.test(v.trim());
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
const looksLikeUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim()) || /^www\.\S+\.\S+/i.test(v.trim());

/**
 * Q5-1 visual direction (+ the client's Q5-2 "words to describe the site")
 * → a design pairing from d4-site-builder's pairings.json, plus optionally
 * a color preset when the client explicitly picked a color flavor. When no
 * preset is set, the pairing's own validated fallback palette applies.
 * Deterministic keyword lookup; first matching rule wins.
 */
const PAIRING_RULES: [string, RegExp][] = [
  ['playful-bright', /playful|fun\b|bubbly|bright|whimsical|cheerful|energetic|kid|family.?friendly/],
  ['calm-wellness', /calm|wellness|sooth|serene|gentle|spa\b|holistic|peaceful|tranquil|yoga|therap/],
  ['quiet-luxury', /luxur|elegant|premium|upscale|refined|sophisticat|high.?end|minimal/],
  ['editorial-voice', /editorial|magazine|journal|literary|publish|newsroom/],
  ['industrial-confidence', /industrial|technical|rugged|manufactur|engineer|machin|construction|welding|trades?\b/],
  ['bold-authority', /bold|authorit|corporate|finance|insurance|banking|law\b|legal/],
  ['warm-craft', /warm|earthy?|craft|handmade|rustic|artisan|farm|homey|local/],
  ['modern-signal', /modern|clean|sleek|crisp|fresh|tech|startup|professional|cool/],
];

function mapDesign(direction: string, words: string): { preset?: string; pairing: string; brandIngest?: boolean; notes: string[] } {
  const d = direction.toLowerCase();
  const notes: string[] = [];
  let preset: string | undefined;
  let brandIngest = false;
  if (/match.*(existing )?brand/.test(d)) {
    brandIngest = true;
    notes.push('Client chose "match existing brand" — run brand ingest on their current site; until then the pairing\'s own palette applies.');
  } else if (/teal|slate|cool/.test(d)) preset = 'slate-teal';
  else if (/sand|warm|earth|ground/.test(d)) preset = 'warm-sand';
  else if (/ink|indigo/.test(d)) preset = 'ink-indigo';

  const v = `${direction} ${words}`.toLowerCase();
  const hit = PAIRING_RULES.find(([, re]) => re.test(v));
  const pairing = hit ? hit[0] : 'modern-signal';
  if (hit) {
    notes.push(`Design pairing proposed: ${pairing} (from visual direction "${direction || 'n/a'}"${words ? ` + site words "${words}"` : ''}).`);
  } else {
    notes.push(`No pairing keywords matched${direction ? ` for "${direction}"` : ' (no visual direction given)'}; defaulted to modern-signal.`);
  }
  return { preset, pairing, brandIngest, notes };
}

const MODULE_DECISIONS: { code: string; module: string; label: string; hint: RegExp }[] = [
  { code: 'Q7A-1', module: 'd4-catalog', label: 'catalog', hint: /catalog|product|equipment/i },
  { code: 'Q8A-1', module: 'd4-careers-portal', label: 'careers', hint: /careers?|job.?opening/i },
  { code: 'Q9A-1', module: 'd4-insights-blog', label: 'blog', hint: /blog|news|insights/i },
  { code: 'Q10A-1', module: 'd4-gallery-editor', label: 'gallery', hint: /gallery|portfolio|case.?stud/i },
];

const CONTEXT_FIELDS: [string, string][] = [
  ['Q3-4', 'Key products/services to promote'], ['Q3-5', 'Primary customers'], ['Q3-6', 'Geographic areas served'],
  ['Q5-2', 'Words to describe the site'], ['Q5-3', 'Colors/fonts/styles to use or avoid'], ['Q5-4', 'Competitor/industry sites to review'],
  ['Q6-1', 'What the site should accomplish'], ['Q6-2', 'Primary visitor action'], ['Q6-3', 'Standard pages expected'],
  ['Q7B-2', 'Catalog categories'], ['Q7B-3', 'Where product info lives now'], ['Q9B-4', 'Blog categories'],
  ['Q10B-1', 'Gallery: what to showcase'], ['Q12-3', 'Content readiness'], ['Q12-2', 'Who approves content'],
  ['Q13-1', 'Business story'], ['Q13-2', 'What makes them different'], ['Q13-3', 'What a prospect should know'],
  ['Q13-4', 'Trust signals to include'], ['Q15-3', 'Launch tied to an event?'], ['Q15-4', 'Scheduling/approval constraints'],
  ['Q18-1', 'Anything else about the project'], ['Q18-2', 'How they heard about Deneb4'],
];

interface StagedIntake {
  slug: string;
  config: Record<string, unknown>;
  clientContact: { name: string; email: string; phone: string };
  flags: Record<string, unknown>;
  unmapped: string[];
  notes: string[];
  context: Record<string, string>;
  mapReport: { field: string; code: string; how: string }[];
  source: string;
  stagedAt: string;
}

/** Build + stage a proposed config from raw form answers. Never applies it. */
/** Split a comma/semicolon/newline list answer into trimmed entries. */
function splitList(raw: string): string[] {
  return (raw || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(no|n\/a|none)$/i.test(s));
}

/**
 * Parse a free-text FAQ answer into {q, a} pairs. Accepts "Q: ... A: ..."
 * blocks or alternating lines (question line ends with "?"). Anything that
 * doesn't pair up cleanly is dropped rather than guessed.
 */
function parseFaqPairs(raw: string): { q: string; a: string }[] {
  const text = (raw || '').trim();
  if (!text) return [];
  const pairs: { q: string; a: string }[] = [];
  const qaBlocks = [...text.matchAll(/Q[:.]\s*([^\n]+)\n+\s*A[:.]\s*([^\n]+)/gi)];
  if (qaBlocks.length) {
    for (const m of qaBlocks) pairs.push({ q: m[1].trim(), a: m[2].trim() });
  } else {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i + 1 < lines.length; i += 2) {
      if (lines[i].endsWith('?')) pairs.push({ q: lines[i], a: lines[i + 1] });
    }
  }
  return pairs.slice(0, 12);
}

function parseAndStage(responses: Responses, driveFolderUrl: string): StagedIntake {
  const read = makeReader(responses);
  const mapReport: StagedIntake['mapReport'] = [];
  const r = (field: string, code: string, hint?: RegExp) => {
    const { value, how } = read(code, hint);
    mapReport.push({ field, code, how });
    return value;
  };

  const cfg: Record<string, unknown> = { $comment: 'd4-site-builder format. Proposed via the live Google Form webhook; review before building.' };
  const unmapped: string[] = [];
  const notes: string[] = [];
  const flags: Record<string, unknown> = {};

  const siteName = r('siteName', 'Q3-1', /business name/i);
  if (siteName) cfg.siteName = siteName; else unmapped.push('siteName (Q3-1)');
  const tagline = r('tagline', 'Q3-2', /tagline/i);
  if (tagline && !/^(no|n\/a|none)$/i.test(tagline)) cfg.tagline = tagline;
  const description = r('description', 'Q3-3', /what does your business do/i);
  if (description) cfg.description = description; else unmapped.push('description (Q3-3)');

  let email = r('contactEmail', 'Q3-7', /public email/i);
  if (!looksLikeEmail(email)) {
    const found = Object.values(responses).map(flatten).find(looksLikeEmail);
    if (found) email = found;
  }
  if (looksLikeEmail(email)) cfg.contactEmail = email; else unmapped.push('contactEmail (Q3-7)');

  const phone = r('phone', 'Q3-8', /public phone/i);
  if (phone) cfg.phone = phone; else unmapped.push('phone (Q3-8)');
  const address = r('address', 'Q3-9', /business address/i);
  if (address) cfg.address = address; else unmapped.push('address (Q3-9)');

  const themeRaw = r('theme', 'Q5-1', /visual direction/i);
  const siteWords = r('siteWords', 'Q5-2', /words.*describe/i);
  const design = mapDesign(themeRaw, siteWords);
  cfg.pairing = design.pairing;
  if (design.preset) cfg.themePreset = design.preset;
  notes.push(...design.notes);
  if (design.brandIngest) flags.brandIngest = true;

  const brandUrl = r('brandUrl', 'Q2A-1', /current website address/i) || Object.values(responses).map(flatten).find(looksLikeUrl) || '';
  if (looksLikeUrl(brandUrl)) {
    flags.brandUrl = brandUrl;
    notes.push(`Existing site: ${brandUrl} — ${design.brandIngest ? 'run' : 'consider'} brand ingest: npm run brand -- <slug> --url ${brandUrl}`);
  }

  const modules: string[] = [];
  for (const d of MODULE_DECISIONS) {
    const ans = r(`module:${d.label}`, d.code, d.hint);
    if (isYes(ans)) modules.push(d.module);
    else if (isUnsure(ans)) notes.push(`${d.label} module: "not sure" — left OFF, confirm before billing it.`);
  }
  if (modules.length) {
    cfg.modules = ['d4-cms-core', ...modules];
    notes.push(`Modules requested: ${modules.join(', ')} (+ d4-cms-core).`);
  } else {
    cfg.modules = [];
    notes.push('No feature modules requested — a core brochure site.');
  }

  if (modules.includes('d4-catalog')) {
    const size = r('catalogSize', 'Q7B-1', /how many products/i);
    if (/51|150|more than/i.test(size)) {
      flags.catalogUpcharge = size;
      notes.push(`Catalog size "${size}" is beyond the included 50 items — price the seeding upcharge.`);
    }
  }

  const customDecision = r('customFunc', 'Q11A-1', /functionality that has not/i);
  if (isYes(customDecision)) {
    const desc = r('customFuncDesc', 'Q11B-1', /describe the functionality/i);
    flags.structuralRequest = desc || 'see form';
    notes.push(`⚠ STRUCTURAL REQUEST (needs your review + a quote, never auto-built): ${desc || '(see Q11B)'}`);
  }

  // ── v1.2.0 shell features (Intake Questionnaire spec, 2026-07-15).
  // Every one of these is optional: a form without the question (or an
  // empty answer) simply leaves the shell default in place. Keep this
  // block in sync with scripts/parse-intake.mjs.
  const primaryAction = r('primaryAction', 'Q6-2', /most important thing.*(do|action)|primary.*action/i);
  const quoteTopicsRaw = r('quoteTopics', 'Q6-4', /ask.*quote.*about|quote topics/i);
  const wantsQuote = /quote|estimate|bid/i.test(primaryAction) || Boolean(quoteTopicsRaw);
  if (primaryAction || quoteTopicsRaw) {
    // The quote modal defaults ON shell-wide; the intake answer supplies
    // its topics and tells the notes whether this is a quote-first business.
    cfg.quote = { enabled: true, topics: splitList(quoteTopicsRaw).slice(0, 5) };
    if (primaryAction) notes.push(`Primary visitor action: "${primaryAction}"${wantsQuote ? ' — quote-first business; the header CTA leads with Request a quote.' : ''}`);
  }
  const announcementText = r('announcement', 'Q6-5', /announce.*banner|time-sensitive/i);
  if (announcementText && !/^(no|n\/a|none|nothing)$/i.test(announcementText)) {
    cfg.announcement = { text: announcementText.slice(0, 160) };
    notes.push(`Announcement bar requested: "${announcementText.slice(0, 80)}" — confirm the link target with the client.`);
  }
  const SOCIAL_CODES: [string, string][] = [
    ['Q14-1', 'LinkedIn'],
    ['Q14-2', 'Facebook'],
    ['Q14-3', 'Instagram'],
    ['Q14-4', 'X'],
    ['Q14-5', 'YouTube'],
  ];
  const socialLinks = SOCIAL_CODES.map(([code, label]) => ({ label, href: r(`social:${label}`, code) }))
    .filter((s) => looksLikeUrl(s.href));
  if (socialLinks.length) cfg.socialLinks = socialLinks;
  const faqRaw = r('faq', 'Q13-5', /questions.*customers.*ask/i);
  const faqPairs = parseFaqPairs(faqRaw);
  if (faqPairs.length) cfg.faq = faqPairs;
  const logosRaw = r('logos', 'Q13-6', /notable clients|partners.*display/i);
  const logoNames = splitList(logosRaw).slice(0, 16);
  if (logoNames.length) {
    cfg.logoWall = { items: logoNames.map((name) => ({ name })) };
    notes.push('Logo wall from client-named partners; swap in real logo files from their Drive folder when available.');
  }
  const billingEmail = r('billingEmail', 'Q4-5', /invoices.*go|billing contact/i);
  if (looksLikeEmail(billingEmail)) notes.push(`Invoices go to: ${billingEmail} (billing contact, not the project contact).`);

  const clientContact = {
    name: r('clientName', 'Q4-1', /what is your name/i),
    email: r('clientEmail', 'Q4-3', /receive project updates/i),
    phone: r('clientPhone', 'Q4-4', /direct phone/i),
  };

  const ghWanted = r('githubWanted', 'Q17A-1', /transferred to your own github/i);
  if (isYes(ghWanted)) {
    flags.githubUser = r('githubUser', 'Q17B-1', /github username/i);
    notes.push('Client wants the repo transferred at handoff.');
  }

  if (isYes(r('discoveryCall', 'Q16A-1', /discovery call/i))) {
    flags.discoveryCall = true;
    notes.push('Client requested a discovery call.');
  }

  if (driveFolderUrl) notes.push(`Drive folder: ${driveFolderUrl}`);

  const context: Record<string, string> = {};
  for (const [code, label] of CONTEXT_FIELDS) {
    const v = read(code).value;
    if (v) context[label] = v;
  }

  const slug = slugify(siteName || `intake-${Date.now()}`);
  return { slug, config: cfg, clientContact, flags, unmapped, notes, context, mapReport, source: 'google-form-webhook', stagedAt: new Date().toISOString() };
}

// ── Event: intake_submitted ──────────────────────────────────────────────
export interface IntakeSubmittedResult {
  slug: string;
  portalUrl: string;
  password?: string;
  widgetKey: string;
  created: boolean;
}

export async function handleIntakeSubmitted(input: {
  responses: Responses;
  driveFolderUrl?: string;
  siteUrl: string;
}): Promise<IntakeSubmittedResult> {
  const staged = parseAndStage(input.responses, input.driveFolderUrl ?? '');
  const name = staged.clientContact.name || staged.config.siteName as string || staged.slug;
  const email = staged.clientContact.email || (staged.config.contactEmail as string) || '';

  const slug = staged.slug;
  let password: string | undefined;
  let created = false;

  if (!clientExists(slug)) {
    password = generateClientPassword();
    const widgetKey = generateWidgetKey();
    writeClient(slug, {
      passwordHash: hashPassword(password),
      data: {
        name, email, phone: staged.clientContact.phone || '', internalNotes: '',
        projectName: (staged.config.siteName as string) || name,
        active: true, stage: '', driveFolder: input.driveFolderUrl ?? '',
        updates: [], files: [], revisions: [], invoices: [], staging: EMPTY_STAGING,
        feedbackOpen: false, feedback: [], widgetKey, lastSeenByClient: '',
        pipeline: 'onboarding', draftReplies: [], githubUser: (staged.flags.githubUser as string) || '',
      },
    });
    created = true;
    appendLedger(slug, {
      agent: 'concierge',
      kind: 'event',
      message: `Client created from the live intake form. Drive folder + build config staged. Pipeline starts at Onboarding.`,
      data: { email },
    });
  } else if (input.driveFolderUrl) {
    // Resubmission or a form-answer edit on an already-known client: don't
    // clobber a manually-set folder link, only fill it in if it's blank.
    setDriveFolderIfEmpty(slug, input.driveFolderUrl);
  }

  // Stage the proposed build config for Ridhi's review (never auto-applied).
  fs.mkdirSync(INTAKE_DIR, { recursive: true });
  fs.writeFileSync(path.join(INTAKE_DIR, `${slug}.json`), JSON.stringify(staged, null, 2));

  // Phase 14 gate #1: the quote drafts itself from the staged config the
  // moment intake lands, so Ridhi's first touch is approve/deny — not
  // "compute a price".
  const quote = draftQuote(slug, 'agent');

  appendLedger(slug, {
    agent: 'concierge',
    kind: 'event',
    message: `Intake received via the live Google Form. Build config staged for your review (content/admin/intake/${slug}.json). ${staged.unmapped.length ? `Missing: ${staged.unmapped.join(', ')}.` : 'All fields mapped.'}${quote ? ` Quote drafted (${money(quoteTotal(quote))}) — approve or deny it on the Quote panel.` : ''} Awaiting the client's onboarding signature.`,
  });

  return {
    slug,
    portalUrl: `${input.siteUrl.replace(/\/$/, '')}/login`,
    password,
    widgetKey: (await getClientBySlug(slug))?.widgetKey ?? '',
    created,
  };
}

// ── Event: onboarding_signed ──────────────────────────────────────────────
export async function handleOnboardingSigned(email: string): Promise<{ slug: string } | null> {
  const client = await findClientByEmail(email);
  if (!client) return null;
  setPipelineStage(client.slug, 'intake-review');
  const msg = `Client signed the onboarding authorization (via the Google Workspace flow). Build config is staged and ready for your review — apply it (npm run intake -- --slug ${client.slug} --apply) then run the Builder when ready.`;
  appendLedger(client.slug, { agent: 'concierge', kind: 'decision', message: msg });
  await notifyOwnerOfAgentAlert(client.slug, 'concierge', msg);
  return { slug: client.slug };
}

// ── Event: handoff_sent (Ridhi's own toolbar click) ──────────────────────
export async function handleHandoffSent(input: { email?: string; slug?: string }): Promise<{ slug: string } | null> {
  const client = input.slug ? await getClientBySlug(input.slug) : await findClientByEmail(input.email ?? '');
  if (!client) return null;
  setPipelineStage(client.slug, 'approval');
  appendLedger(client.slug, {
    agent: 'concierge',
    kind: 'event',
    message: `Final approval requested (via your Handoff Document automation). Awaiting the client's signature on the Handoff Authorization Form.`,
  });
  return { slug: client.slug };
}

// ── Event: handoff_signed (client's final sign-off) ──────────────────────
export async function handleHandoffSigned(email: string): Promise<{ slug: string; advanced: boolean } | null> {
  const client = await findClientByEmail(email);
  if (!client) return null;
  const advanced = await recordClientSignoff(client, SIGNOFF_PHASE);
  return { slug: client.slug, advanced };
}

async function findClientByEmail(email: string): Promise<Client | null> {
  if (!email) return null;
  const { getClientByEmail } = await import('./clients');
  return getClientByEmail(email);
}

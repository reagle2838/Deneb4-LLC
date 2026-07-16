#!/usr/bin/env node
/**
 * Intake parser (ROADMAP Phase 6: "intake delivery, collection, parse into
 * compiler config"). Turns a filled-out Deneb4 intake — exported from Google
 * Forms as a CSV (Responses → ⋮ → Download responses .csv) — into a PROPOSED
 * build config for the Builder, plus the client-contact record, decision
 * flags (structural request, catalog upcharge, discovery call, GitHub
 * transfer, brand ingest), and a context bundle of the rich answers for
 * Ridhi. It proposes; Ridhi disposes: staged for review, never written
 * straight to content/build-configs/. Never invents a fact.
 *
 * Mapping is by the form's stable per-question CODES (Q3-1, Q7A-1, ...),
 * which Google uses verbatim as CSV headers — exact and reword-proof — with
 * a keyword fuzzy fallback and a printed mapping report so nothing is ever
 * silently missed. If the form changes, update the codes in MODULE_DECISIONS
 * / the read() calls / CONTEXT_FIELDS below.
 *
 * Usage:
 *   npm run intake -- --file responses.csv [--row 1] [--slug acme]   # stage
 *   npm run intake -- --slug acme --preview                          # show staged
 *   npm run intake -- --slug acme --apply [--report-to <origin>]     # write build config
 *   npm run intake -- --slug acme --discard
 *
 * One CSV can hold many responses; --row picks which (1-based, default 1).
 * The slug is derived from the business name unless you pass --slug.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const INTAKE_DIR = path.join(REPO_ROOT, 'content', 'admin', 'intake');
const BUILD_CONFIGS_DIR = path.join(REPO_ROOT, 'content', 'build-configs');

const args = process.argv.slice(2);
const has = (n) => args.includes(`--${n}`);
const optOf = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const reportTo = (optOf('report-to') || 'http://localhost:3005').replace(/\/$/, '');

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── CSV parsing (shared conventions with seed-content) ──────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

// ── Column matching by stable Q-code (with fuzzy fallback) ──────────────
// The Deneb4 Google Form titles every question with a stable code
// (Q3-1, Q7A-1, ...). Google uses the exact title as the CSV column header,
// so matching on the code is exact AND survives Ridhi rewording a question
// later. If a code can't be found (form edited, code dropped), each field
// has a keyword fallback, and the mapping report shows how every field was
// resolved so nothing is ever silently missed.

function makeColFinder(headers) {
  const norm = headers.map((h) => String(h).trim());
  return (code, hint) => {
    // Exact code prefix: "Q3-1." / "Q3-1 " / "Q3-1:" / "Q3-1" — the
    // lookahead stops "Q3-1" from also matching "Q3-10" or "Q3-1A".
    const codeRe = new RegExp('^' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[.\\s:)\\-]|$)', 'i');
    let idx = norm.findIndex((h) => codeRe.test(h));
    if (idx >= 0) return { idx, how: 'code' };
    if (hint) {
      idx = norm.findIndex((h) => hint.test(h));
      if (idx >= 0) return { idx, how: 'fuzzy' };
    }
    return { idx: -1, how: 'none' };
  };
}

const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v).trim());
const looksLikeUrl = (v) => /^https?:\/\/\S+$/i.test(String(v).trim()) || /^www\.\S+\.\S+/i.test(String(v).trim());
const isYes = (v) => /^yes\b/i.test(String(v).trim());
const isUnsure = (v) => /not sure|unsure|maybe/i.test(String(v).trim());

// Q5-1 visual direction (+ Q5-2 site words) → a design pairing from
// d4-site-builder's pairings.json, plus optionally a color preset when the
// client explicitly picked a color flavor. When no preset is set, the
// pairing's own validated fallback palette applies. Keyworded so it
// survives the exact em-dash wording; first matching rule wins.
// (Deliberately kept identical to the copy in src/lib/intake-webhook.ts —
// Apps Script and Node can't share one file across runtimes.)
const PAIRING_RULES = [
  ['playful-bright', /playful|fun\b|bubbly|bright|whimsical|cheerful|energetic|kid|family.?friendly/],
  ['calm-wellness', /calm|wellness|sooth|serene|gentle|spa\b|holistic|peaceful|tranquil|yoga|therap/],
  ['quiet-luxury', /luxur|elegant|premium|upscale|refined|sophisticat|high.?end|minimal/],
  ['editorial-voice', /editorial|magazine|journal|literary|publish|newsroom/],
  ['industrial-confidence', /industrial|technical|rugged|manufactur|engineer|machin|construction|welding|trades?\b/],
  ['bold-authority', /bold|authorit|corporate|finance|insurance|banking|law\b|legal/],
  ['warm-craft', /warm|earthy?|craft|handmade|rustic|artisan|farm|homey|local/],
  ['modern-signal', /modern|clean|sleek|crisp|fresh|tech|startup|professional|cool/],
];

function mapDesign(direction, words) {
  const d = String(direction).toLowerCase();
  const notes = [];
  let preset;
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

// The four module decision questions (explicit Yes/No/Not-sure).
const MODULE_DECISIONS = [
  { code: 'Q7A-1', module: 'd4-catalog', label: 'catalog', hint: /catalog|product|equipment/i },
  { code: 'Q8A-1', module: 'd4-careers-portal', label: 'careers', hint: /careers?|job.?opening/i },
  { code: 'Q9A-1', module: 'd4-insights-blog', label: 'blog', hint: /blog|news|insights/i },
  { code: 'Q10A-1', module: 'd4-gallery-editor', label: 'gallery', hint: /gallery|portfolio|case.?stud/i },
];

// Rich context answers — NOT config, but everything Ridhi wants in one place
// (About-page material, scoping detail, seeding pointers). code → label.
const CONTEXT_FIELDS = [
  ['Q3-4', 'Key products/services to promote'],
  ['Q3-5', 'Primary customers'],
  ['Q3-6', 'Geographic areas served'],
  ['Q5-2', 'Words to describe the site'],
  ['Q5-3', 'Colors/fonts/styles to use or avoid'],
  ['Q5-4', 'Competitor/industry sites to review'],
  ['Q6-1', 'What the site should accomplish'],
  ['Q6-2', 'Primary visitor action'],
  ['Q6-3', 'Standard pages expected'],
  ['Q7B-2', 'Catalog categories'],
  ['Q7B-3', 'Where product info lives now'],
  ['Q9B-4', 'Blog categories'],
  ['Q10B-1', 'Gallery: what to showcase'],
  ['Q12-3', 'Content readiness (ready vs pending)'],
  ['Q12-2', 'Who approves content'],
  ['Q13-1', 'Business story'],
  ['Q13-2', 'What makes them different'],
  ['Q13-3', 'What a prospect should know'],
  ['Q13-4', 'Trust signals to include'],
  ['Q15-3', 'Launch tied to an event?'],
  ['Q15-4', 'Scheduling/approval constraints'],
  ['Q18-1', 'Anything else about the project'],
  ['Q18-2', 'How they heard about Deneb4'],
];

// ── Stage ────────────────────────────────────────────────────────────────
function stage() {
  const file = optOf('file');
  if (!file) { console.error('Staging needs --file <responses.csv>.'); process.exit(2); }
  const rowNum = Number(optOf('row')) || 1;

  const rows = parseCsv(fs.readFileSync(file, 'utf-8'));
  if (rows.length < 2) { console.error('CSV has no response rows.'); process.exit(2); }
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);
  if (rowNum > dataRows.length) { console.error(`Row ${rowNum} doesn't exist (only ${dataRows.length} response(s)).`); process.exit(2); }
  const record = dataRows[rowNum - 1];
  const col = makeColFinder(headers);
  const mapReport = []; // { field, code, how, header }

  // Read a field by code (+ fuzzy hint); record how it resolved.
  const read = (field, code, hint) => {
    const { idx, how } = col(code, hint);
    mapReport.push({ field, code, how, header: idx >= 0 ? headers[idx] : null });
    return idx >= 0 ? String(record[idx] ?? '').trim() : '';
  };

  const cfg = { $comment: 'd4-site-builder format. Proposed by the intake parser from the Deneb4 form; review before building.' };
  const unmapped = [];
  const notes = [];
  const flags = {};

  // ── Identity (public-facing, goes in the build config) ───────────────
  const siteName = read('siteName', 'Q3-1', /business name/i);
  if (siteName) cfg.siteName = siteName; else unmapped.push('siteName (Q3-1 business name)');

  const tagline = read('tagline', 'Q3-2', /tagline/i);
  if (tagline && !/^(no|n\/a|none)$/i.test(tagline)) cfg.tagline = tagline;

  const description = read('description', 'Q3-3', /what does your business do/i);
  if (description) cfg.description = description; else unmapped.push('description (Q3-3)');

  let email = read('contactEmail', 'Q3-7', /public email/i);
  if (!looksLikeEmail(email)) {
    const found = record.find((v) => looksLikeEmail(v));
    if (found) { email = String(found).trim(); notes.push('Public email recovered from another column.'); }
  }
  if (looksLikeEmail(email)) cfg.contactEmail = email; else unmapped.push('contactEmail (Q3-7)');

  const phone = read('phone', 'Q3-8', /public phone/i);
  if (phone) cfg.phone = phone; else unmapped.push('phone (Q3-8)');

  const address = read('address', 'Q3-9', /business address/i);
  if (address) cfg.address = address; else unmapped.push('address (Q3-9)');

  // ── Design: pairing + optional color preset (Q5-1 + Q5-2) ───────────
  const themeRaw = read('theme', 'Q5-1', /visual direction/i);
  const siteWords = read('siteWords', 'Q5-2', /words.*describe/i);
  const design = mapDesign(themeRaw, siteWords);
  cfg.pairing = design.pairing;
  if (design.preset) cfg.themePreset = design.preset;
  notes.push(...design.notes);
  if (design.brandIngest) flags.brandIngest = true;

  // Brand-ingest URL: the current-site question (only relevant on the
  // "existing website" branch), or any URL the client dropped in.
  const brandUrl = read('brandUrl', 'Q2A-1', /current website address/i) || (record.find((v) => looksLikeUrl(v)) ?? '');
  if (looksLikeUrl(brandUrl)) {
    flags.brandUrl = String(brandUrl).trim();
    notes.push(`Existing site: ${flags.brandUrl} — ${design.brandIngest ? 'run' : 'consider'} brand ingest: npm run brand -- <slug> --url ${flags.brandUrl}`);
  }

  // ── Modules (explicit Yes/No decision questions) ─────────────────────
  const modules = [];
  for (const d of MODULE_DECISIONS) {
    const ans = read(`module:${d.label}`, d.code, d.hint);
    if (isYes(ans)) modules.push(d.module);
    else if (isUnsure(ans)) notes.push(`${d.label} module: client answered "not sure" — left OFF (don't bill for an unrequested module). Confirm on the discovery call.`);
  }
  if (modules.length) {
    cfg.modules = ['d4-cms-core', ...modules]; // features need the CMS
    notes.push(`Modules requested: ${modules.join(', ')} (+ d4-cms-core for the admin dashboard).`);
  } else {
    cfg.modules = [];
    notes.push('No feature modules requested — a core brochure site (Home/About/Contact).');
  }

  // Catalog size → the 50-item upcharge boundary (Q7B-1).
  if (modules.includes('d4-catalog')) {
    const size = read('catalogSize', 'Q7B-1', /how many products/i);
    if (/51|150|more than/i.test(size)) {
      flags.catalogUpcharge = size;
      notes.push(`Catalog size "${size}" is beyond the included 50 items — price the seeding upcharge.`);
    }
  }

  // ── Custom functionality (Q11) → structural request, never auto-built ─
  const customDecision = read('customFunc', 'Q11A-1', /functionality that has not/i);
  if (isYes(customDecision)) {
    const desc = read('customFuncDesc', 'Q11B-1', /describe the functionality/i);
    flags.structuralRequest = desc || 'see form';
    notes.push(`⚠ STRUCTURAL REQUEST (off-menu, needs your review + a quote, never auto-built): ${desc || '(client marked yes; see Q11B)'}`);
  }

  // ── v1.2.0 shell features (Intake Questionnaire spec, 2026-07-15) ─────
  // All optional: a form without the question leaves the shell default in
  // place. Keep this block in sync with src/lib/intake-webhook.ts.
  const splitList = (raw) =>
    (raw || '')
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s && !/^(no|n\/a|none)$/i.test(s));
  const primaryAction = read('primaryAction', 'Q6-2', /most important thing.*(do|action)|primary.*action/i);
  const quoteTopicsRaw = read('quoteTopics', 'Q6-4', /ask.*quote.*about|quote topics/i);
  if (primaryAction || quoteTopicsRaw) {
    cfg.quote = { enabled: true, topics: splitList(quoteTopicsRaw).slice(0, 5) };
    if (primaryAction) {
      const quoteFirst = /quote|estimate|bid/i.test(primaryAction);
      notes.push(`Primary visitor action: "${primaryAction}"${quoteFirst ? ' — quote-first business; the header CTA leads with Request a quote.' : ''}`);
    }
  }
  const announcementText = read('announcement', 'Q6-5', /announce.*banner|time-sensitive/i);
  if (announcementText && !/^(no|n\/a|none|nothing)$/i.test(announcementText)) {
    cfg.announcement = { text: announcementText.slice(0, 160) };
    notes.push(`Announcement bar requested: "${announcementText.slice(0, 80)}" — confirm the link target with the client.`);
  }
  const socialLinks = [
    ['Q14-1', 'LinkedIn'],
    ['Q14-2', 'Facebook'],
    ['Q14-3', 'Instagram'],
    ['Q14-4', 'X'],
    ['Q14-5', 'YouTube'],
  ]
    .map(([code, label]) => ({ label, href: read(`social:${label}`, code) }))
    .filter((s) => /^https?:\/\//i.test(s.href));
  if (socialLinks.length) cfg.socialLinks = socialLinks;
  const faqRaw = read('faq', 'Q13-5', /questions.*customers.*ask/i);
  const faqPairs = [];
  for (const m of (faqRaw || '').matchAll(/Q[:.]\s*([^\n]+)\n+\s*A[:.]\s*([^\n]+)/gi)) {
    faqPairs.push({ q: m[1].trim(), a: m[2].trim() });
  }
  if (!faqPairs.length) {
    const lines = (faqRaw || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i + 1 < lines.length; i += 2) {
      if (lines[i].endsWith('?')) faqPairs.push({ q: lines[i], a: lines[i + 1] });
    }
  }
  if (faqPairs.length) cfg.faq = faqPairs.slice(0, 12);
  const logoNames = splitList(read('logos', 'Q13-6', /notable clients|partners.*display/i)).slice(0, 16);
  if (logoNames.length) {
    cfg.logoWall = { items: logoNames.map((name) => ({ name })) };
    notes.push('Logo wall from client-named partners; swap in real logo files from their Drive folder when available.');
  }
  const billingEmail = read('billingEmail', 'Q4-5', /invoices.*go|billing contact/i);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(billingEmail)) {
    notes.push(`Invoices go to: ${billingEmail} (billing contact, not the project contact).`);
  }

  // ── Client point of contact (goes on the CLIENT RECORD, not the config) ─
  const clientContact = {
    name: read('clientName', 'Q4-1', /what is your name/i),
    email: read('clientEmail', 'Q4-3', /receive project updates/i),
    phone: read('clientPhone', 'Q4-4', /direct phone/i),
  };
  if (clientContact.name || clientContact.email) {
    notes.push(`Create the client with — name: ${clientContact.name || '(?)'}, email: ${clientContact.email || '(?)'}${clientContact.phone ? `, phone: ${clientContact.phone}` : ''}.`);
  }

  // ── GitHub transfer at handoff (Q17) ─────────────────────────────────
  const ghWanted = read('githubWanted', 'Q17A-1', /transferred to your own github/i);
  if (isYes(ghWanted)) {
    const ghUser = read('githubUser', 'Q17B-1', /github username/i);
    flags.githubUser = ghUser;
    notes.push(`Client wants the repo transferred at handoff${ghUser ? ` — GitHub username: ${ghUser}` : ' (username not given)'}. Set it on the client record.`);
  }

  // ── Discovery call (Q16) ─────────────────────────────────────────────
  const callWanted = read('discoveryCall', 'Q16A-1', /discovery call/i);
  if (isYes(callWanted)) {
    flags.discoveryCall = true;
    notes.push('Client requested a 30-minute discovery call — schedule it (see Q16B answers for availability).');
  }

  // ── Rich context bundle for Ridhi (not config) ───────────────────────
  const context = {};
  for (const [code, label] of CONTEXT_FIELDS) {
    const { idx } = col(code);
    const v = idx >= 0 ? String(record[idx] ?? '').trim() : '';
    if (v) context[label] = v;
  }

  const slug = optOf('slug') || slugify(siteName || `intake-${Date.now()}`);
  fs.mkdirSync(INTAKE_DIR, { recursive: true });
  const staged = {
    slug, config: cfg, clientContact, flags, unmapped, notes, context,
    mapReport, source: path.basename(file), row: rowNum, stagedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(INTAKE_DIR, `${slug}.json`), JSON.stringify(staged, null, 2));

  // ── Report ───────────────────────────────────────────────────────────
  console.log(`\nStaged a proposed build config for "${cfg.siteName || slug}" (slug: ${slug}):\n`);
  console.log(JSON.stringify(cfg, null, 2));

  const fuzzy = mapReport.filter((m) => m.how === 'fuzzy');
  const missed = mapReport.filter((m) => m.how === 'none');
  console.log(`\nField mapping: ${mapReport.filter((m) => m.how === 'code').length} matched by exact code, ${fuzzy.length} by fuzzy fallback, ${missed.length} not found.`);
  if (fuzzy.length) console.log('  fuzzy-matched (verify): ' + fuzzy.map((m) => `${m.field}←"${m.header}"`).join(', '));
  if (missed.length) console.log('  NOT FOUND (column missing): ' + missed.map((m) => `${m.field} (${m.code})`).join(', '));

  if (unmapped.length) console.log(`\n⚠ Config fields the form didn't fill (add before building): ${unmapped.join(', ')}.`);
  if (notes.length) { console.log('\nNotes:'); for (const n of notes) console.log(`  - ${n}`); }
  console.log(`\nFull staged detail (context, flags, contact): content/admin/intake/${slug}.json`);
  console.log(`Then: npm run intake -- --slug ${slug} --apply   (creates content/build-configs/${slug}.json)`);
}

// ── Preview / discard / apply ───────────────────────────────────────────
function loadStaged(slug) {
  const fp = path.join(INTAKE_DIR, `${slug}.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function preview(slug) {
  const s = loadStaged(slug);
  if (!s) return console.log(`Nothing staged for ${slug}.`);
  console.log('BUILD CONFIG:\n' + JSON.stringify(s.config, null, 2));
  if (s.clientContact && (s.clientContact.name || s.clientContact.email)) {
    console.log(`\nCLIENT CONTACT (for the client record): ${s.clientContact.name || '(?)'} · ${s.clientContact.email || '(?)'}${s.clientContact.phone ? ' · ' + s.clientContact.phone : ''}`);
  }
  if (s.flags && Object.keys(s.flags).length) console.log('\nFLAGS: ' + JSON.stringify(s.flags));
  if (s.unmapped?.length) console.log(`\n⚠ Unmapped config fields: ${s.unmapped.join(', ')}.`);
  if (s.notes?.length) console.log('\nNOTES:\n' + s.notes.map((n) => `  - ${n}`).join('\n'));
  if (s.context && Object.keys(s.context).length) {
    console.log('\nCONTEXT (for you / the About page / content seeding):');
    for (const [label, val] of Object.entries(s.context)) {
      console.log(`  ${label}: ${val.length > 100 ? val.slice(0, 97) + '...' : val}`);
    }
  }
}

function discard(slug) {
  const fp = path.join(INTAKE_DIR, `${slug}.json`);
  if (fs.existsSync(fp)) fs.rmSync(fp);
  console.log(`Staged intake for ${slug} discarded.`);
}

async function ledger(slug, message) {
  try {
    const env = fs.readFileSync(path.join(REPO_ROOT, '.env.local'), 'utf-8');
    const key = (env.match(/^AGENT_API_KEY=(.+)$/m) || [])[1]?.trim();
    if (!key) return;
    await fetch(`${reportTo}/api/agents/ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': key },
      body: JSON.stringify({ channel: slug, agent: 'concierge', kind: 'event', message }),
    });
  } catch { /* CLI output is the record */ }
}

async function apply(slug) {
  const s = loadStaged(slug);
  if (!s) { console.error(`Nothing staged for ${slug}. Stage it first with --file.`); process.exit(2); }
  if (!s.config.siteName) {
    console.error('Refusing to apply: the config has no siteName. Fill it into the staged file first (the Builder needs it).');
    process.exit(1);
  }
  fs.mkdirSync(BUILD_CONFIGS_DIR, { recursive: true });
  const dest = path.join(BUILD_CONFIGS_DIR, `${slug}.json`);
  if (fs.existsSync(dest)) {
    console.error(`Refusing: content/build-configs/${slug}.json already exists. Delete it first if you mean to replace it.`);
    process.exit(1);
  }
  fs.writeFileSync(dest, JSON.stringify(s.config, null, 2) + '\n');
  fs.rmSync(path.join(INTAKE_DIR, `${slug}.json`));
  console.log(`Wrote content/build-configs/${slug}.json.`);
  console.log(`Next: create the client + set pipeline to "building", then npm run builder -- ${slug} --report-to ${reportTo}`);
  await ledger(slug, `Intake parsed into a build config (from ${s.source}). Modules: ${(s.config.modules || []).join(', ') || 'none'}. Ready to build.`);
}

// ── Route ────────────────────────────────────────────────────────────────
const slug = optOf('slug');
if (has('preview')) { if (!slug) { console.error('--preview needs --slug.'); process.exit(2); } preview(slug); }
else if (has('discard')) { if (!slug) { console.error('--discard needs --slug.'); process.exit(2); } discard(slug); }
else if (has('apply')) { if (!slug) { console.error('--apply needs --slug.'); process.exit(2); } await apply(slug); }
else stage();

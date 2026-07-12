#!/usr/bin/env node
/**
 * Intake parser (ROADMAP Phase 6: "intake delivery, collection, parse into
 * compiler config"). Turns a filled-out intake — exported from Google Forms
 * as a CSV (Responses sheet → File → Download → CSV) — into a PROPOSED build
 * config for the Builder. Like everything else here, it proposes; Ridhi
 * disposes: the config is STAGED for review, never written straight to
 * content/build-configs/. It never invents a fact — anything it can't map
 * confidently is listed for you to fill in.
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

// ── Fuzzy header mapping ────────────────────────────────────────────────
// Each field: keyword patterns matched against the (lowercased) header.
const FIELD_HINTS = {
  siteName: [/business\s*name/, /company\s*name/, /organi[sz]ation/, /\bsite\s*name/, /name of (your |the )?(business|company)/, /^name$/],
  tagline: [/tagline/, /slogan/, /motto/, /one[\s-]*liner/, /one[\s-]*line/, /headline/],
  description: [/description/, /what (do |does )?you( do| make| offer)?/, /about (your|the) (business|company)/, /\babout\b/, /elevator pitch/, /summary/],
  contactEmail: [/e[\s-]*mail/, /contact email/, /best email/],
  phone: [/phone/, /telephone/, /\bcell\b/, /mobile/, /contact number/],
  address: [/address/, /location/, /where.*(located|based)/, /mailing/, /street/],
  theme: [/colou?r/, /theme/, /palette/, /style/, /\bfeel\b/, /look and feel/, /brand.*colou?r/, /aesthetic/],
  features: [/feature/, /(which|what).*(page|section|module)/, /add[\s-]*on/, /\bsection/, /modules?/],
  brandUrl: [/current (web)?site/, /existing (web)?site/, /old (web)?site/, /website url/, /your website/, /web address/],
};

function scoreHeader(header, patterns) {
  const h = header.toLowerCase();
  for (const p of patterns) if (p.test(h)) return true;
  return false;
}

function mapHeaders(headers) {
  const map = {}; // field -> column index
  const claimed = new Set();
  // FIELD_HINTS order is priority order: identity fields (specific) before
  // theme/features, so a column is claimed by its most specific field and
  // never reused by a broader one.
  for (const [field, patterns] of Object.entries(FIELD_HINTS)) {
    const idx = headers.findIndex((h, i) => !claimed.has(i) && scoreHeader(h, patterns));
    if (idx >= 0) {
      map[field] = idx;
      claimed.add(idx);
    }
  }
  return map;
}

// ── Value interpretation ────────────────────────────────────────────────
const THEME_KEYWORDS = [
  { preset: 'slate-teal', re: /teal|slate|blue|cool|grey|gray|professional|corporate|clean|tech/i },
  { preset: 'warm-sand', re: /sand|warm|earth|tan|beige|natural|organic|cream|gold|amber/i },
  { preset: 'ink-indigo', re: /indigo|ink|purple|violet|dark|bold|navy|deep/i },
];
function mapTheme(value) {
  if (!value) return null;
  for (const { preset, re } of THEME_KEYWORDS) if (re.test(value)) return preset;
  return null;
}

const MODULE_KEYWORDS = [
  { module: 'd4-careers-portal', re: /career|job|hiring|recruit|apply|position|employment|vacanc/i },
  { module: 'd4-insights-blog', re: /blog|article|insight|news|post|stor(y|ies)|updates/i },
  { module: 'd4-catalog', re: /catalog|catalogue|product|equipment|part|inventory|item|shop/i },
  { module: 'd4-gallery-editor', re: /gallery|galleries|photo|picture|image|portfolio|showcase/i },
];
function mapModules(featuresText) {
  // Only the features answer — never inferred from prose or contact fields,
  // where words like "shop" or "part" would trip false positives.
  const found = new Set();
  if (!featuresText) return [];
  for (const { module, re } of MODULE_KEYWORDS) if (re.test(featuresText)) found.add(module);
  return [...found];
}

const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
const looksLikeUrl = (v) => /^https?:\/\/\S+$/i.test(v.trim()) || /^www\.\S+\.\S+/i.test(v.trim());

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
  const cell = (i) => (i >= 0 && i < record.length ? String(record[i] ?? '').trim() : '');

  const map = mapHeaders(headers);
  const cfg = { $comment: 'd4-site-builder format. Proposed by the intake parser; review before building.' };
  const unmapped = [];
  const notes = [];

  // Identity fields (fact-slot rule: only set what the form actually gave).
  const siteName = map.siteName != null ? cell(map.siteName) : '';
  if (siteName) cfg.siteName = siteName; else unmapped.push('siteName (business name)');
  if (map.tagline != null && cell(map.tagline)) cfg.tagline = cell(map.tagline); else unmapped.push('tagline');
  if (map.description != null && cell(map.description)) cfg.description = cell(map.description); else unmapped.push('description');

  // Contact: honor the mapped column, but also rescue an email/phone that
  // landed in an oddly-named column.
  let email = map.contactEmail != null ? cell(map.contactEmail) : '';
  if (!email || !looksLikeEmail(email)) {
    const found = record.find((v) => looksLikeEmail(String(v)));
    if (found) { email = String(found).trim(); notes.push('Email recovered from an unlabeled column.'); }
  }
  if (email && looksLikeEmail(email)) cfg.contactEmail = email.trim(); else unmapped.push('contactEmail');

  if (map.phone != null && cell(map.phone)) cfg.phone = cell(map.phone); else unmapped.push('phone');
  if (map.address != null && cell(map.address)) cfg.address = cell(map.address); else unmapped.push('address');

  // Theme
  const themeRaw = map.theme != null ? cell(map.theme) : '';
  const preset = mapTheme(themeRaw);
  if (preset) {
    cfg.themePreset = preset;
    if (themeRaw) notes.push(`Theme "${themeRaw}" → preset ${preset}.`);
  } else {
    cfg.themePreset = 'slate-teal';
    notes.push(themeRaw ? `Theme "${themeRaw}" didn't match a preset; defaulted to slate-teal (change or run brand ingest).` : 'No theme given; defaulted to slate-teal.');
  }

  // Modules come only from the features answer (fact-slot rule).
  const featuresCell = map.features != null ? cell(map.features) : '';
  const modules = mapModules(featuresCell);
  if (modules.length) {
    // Feature modules depend on the CMS; include it explicitly.
    cfg.modules = ['d4-cms-core', ...modules];
    notes.push(`Modules from the form: ${modules.join(', ')} (+ d4-cms-core for the admin dashboard).`);
  } else {
    cfg.modules = [];
    notes.push(
      featuresCell
        ? `Features answer ("${featuresCell}") didn't match any module; add modules manually if needed.`
        : map.features == null
          ? 'No features question found in the form; a brochure site with no extra modules. Add modules if the client wants them.'
          : 'No features selected; a brochure site with no extra modules.'
    );
  }

  // Brand ingest hint
  const brandUrl = map.brandUrl != null ? cell(map.brandUrl) : record.find((v) => looksLikeUrl(String(v)));
  if (brandUrl && looksLikeUrl(String(brandUrl))) {
    notes.push(`Client has an existing site (${String(brandUrl).trim()}); consider: npm run brand -- <slug> --url ${String(brandUrl).trim()}`);
  }

  const slug = optOf('slug') || slugify(siteName || `intake-${Date.now()}`);
  fs.mkdirSync(INTAKE_DIR, { recursive: true });
  const staged = { slug, config: cfg, unmapped, notes, source: path.basename(file), row: rowNum, stagedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(INTAKE_DIR, `${slug}.json`), JSON.stringify(staged, null, 2));

  console.log(`\nStaged a proposed build config for "${cfg.siteName || slug}" (slug: ${slug}):\n`);
  console.log(JSON.stringify(cfg, null, 2));
  if (unmapped.length) {
    console.log(`\n⚠ Couldn't fill from the form (add before building): ${unmapped.join(', ')}.`);
  }
  if (notes.length) {
    console.log('\nNotes:');
    for (const n of notes) console.log(`  - ${n}`);
  }
  console.log(`\nReview: content/admin/intake/${slug}.json`);
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
  console.log(JSON.stringify(s.config, null, 2));
  if (s.unmapped?.length) console.log(`\n⚠ Unmapped: ${s.unmapped.join(', ')}.`);
  if (s.notes?.length) console.log('\nNotes:\n' + s.notes.map((n) => `  - ${n}`).join('\n'));
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

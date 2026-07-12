#!/usr/bin/env node
/**
 * Content pre-seeding (ROADMAP: intake material → module data), with a
 * review gate. Client-supplied material (a CSV of products, a JSON dump of
 * job postings, or — with the LLM key — a plain-text document) is parsed
 * into the exact shapes the d4 modules read from data/*.json, then STAGED
 * for review. Nothing touches the client's site until the explicit apply
 * step, and applying merges by id — it never clobbers content the client
 * has already authored through their /admin.
 *
 * Usage:
 *   npm run seed -- <slug> --file <material.csv|.json|.txt> --type jobs|articles|products|galleries [--gallery <name>]
 *   npm run seed -- <slug> --preview            # show what's staged
 *   npm run seed -- <slug> --apply [--report-to <origin>]
 *   npm run seed -- <slug> --discard            # reject staged seeds
 *
 * CSV conventions: first row = headers matching the field names below.
 *   jobs:      title, type, location, description, requirements ("a|b|c"), postedAt
 *   articles:  title, subtitle, date, body, tags ("a|b"), image, author
 *   products:  title, category, description, image, partNumber, link, specs ("Label:Value|Label:Value")
 *   galleries: url, alt   (with --gallery <name>; urls must already be served by the site)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const has = (name) => args.includes(`--${name}`);
function opt(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEEDS_DIR = path.join(REPO_ROOT, 'content', 'admin', 'seeds');
const usage = () => {
  console.error('Usage: npm run seed -- <slug> --file <path> --type <jobs|articles|products|galleries> [--gallery <name>]');
  console.error('       npm run seed -- <slug> --preview | --apply | --discard');
  process.exit(2);
};
if (!slug) usage();

const TYPES = ['jobs', 'articles', 'products', 'galleries'];
const stagePath = (type) => path.join(SEEDS_DIR, slug, `${type}.json`);
const id = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);

// ── Ledger reporting (best-effort) ───────────────────────────────────────
async function ledger(kind, message) {
  try {
    const env = fs.readFileSync(path.join(REPO_ROOT, '.env.local'), 'utf-8');
    const key = (env.match(/^AGENT_API_KEY=(.+)$/m) || [])[1]?.trim();
    const origin = (opt('report-to') || 'http://localhost:3005').replace(/\/$/, '');
    if (!key) return;
    await fetch(`${origin}/api/agents/ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': key },
      body: JSON.stringify({ channel: slug, agent: 'concierge', kind, message }),
    });
  } catch {
    /* the CLI output is the primary record here */
  }
}

// The /api/agents/billing route computes the actual $ from raw token
// counts (src/lib/pricing.ts's computeAnthropicCost, reading live from
// pricing.yaml) — this script just reports what it used and lets that one
// source of truth do the math, so the rate table only exists in one place.
async function recordApiCost(model, inputTokens, outputTokens, note) {
  try {
    const env = fs.readFileSync(path.join(REPO_ROOT, '.env.local'), 'utf-8');
    const key = (env.match(/^AGENT_API_KEY=(.+)$/m) || [])[1]?.trim();
    const origin = (opt('report-to') || 'http://localhost:3005').replace(/\/$/, '');
    if (!key) return;
    await fetch(`${origin}/api/agents/billing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': key },
      body: JSON.stringify({ slug, action: 'record-api-usage', model, inputTokens, outputTokens, note }),
    });
  } catch {
    /* the CLI output is the primary record here */
  }
}

// ── CSV parsing (quoted fields, commas, newlines-in-quotes) ─────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// ── Normalizers: raw records → the exact module shapes ──────────────────
const JOB_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship'];
const splitList = (v) => (Array.isArray(v) ? v.map(String) : String(v ?? '').split('|').map((s) => s.trim()).filter(Boolean));

const NORMALIZERS = {
  jobs: (r) => ({
    id: String(r.id || id()),
    title: String(r.title ?? '').trim(),
    type: JOB_TYPES.includes(String(r.type)) ? String(r.type) : 'Full-Time',
    location: String(r.location ?? '').trim(),
    description: String(r.description ?? '').trim(),
    requirements: splitList(r.requirements),
    postedAt: String(r.postedAt || today()),
  }),
  articles: (r) => ({
    id: String(r.id || id()),
    title: String(r.title ?? '').trim(),
    subtitle: String(r.subtitle ?? '').trim(),
    date: String(r.date || today()),
    body: String(r.body ?? '').trim(),
    tags: splitList(r.tags),
    ...(r.image ? { image: String(r.image) } : {}),
    ...(r.author ? { author: String(r.author) } : {}),
  }),
  products: (r) => ({
    id: String(r.id || id()),
    title: String(r.title ?? '').trim(),
    category: String(r.category ?? 'general').trim(),
    description: String(r.description ?? '').trim(),
    ...(r.image ? { image: String(r.image) } : {}),
    specs: Array.isArray(r.specs)
      ? r.specs.map((s) => ({ label: String(s.label ?? ''), value: String(s.value ?? '') }))
      : splitList(r.specs).map((pair) => {
          const [label, ...rest] = pair.split(':');
          return { label: label.trim(), value: rest.join(':').trim() };
        }),
    ...(r.partNumber ? { partNumber: String(r.partNumber) } : {}),
    ...(r.link ? { link: String(r.link) } : {}),
  }),
  galleries: (r) => ({
    id: String(r.id || id()),
    url: String(r.url ?? '').trim(),
    alt: String(r.alt ?? '').trim(),
  }),
};
const REQUIRED = { jobs: 'title', articles: 'title', products: 'title', galleries: 'url' };

// ── LLM seam for unstructured material (key-gated, comms pattern) ───────
// Fact extraction, not prose generation: high potential volume, no tone to
// get right, and every item is human-reviewed (--preview) before --apply
// touches anything. Cheap Haiku by default is the deliberate choice here —
// contrast src/lib/comms.ts, which drafts client-facing reply text and
// defaults to Sonnet instead. Override with SEED_LLM_MODEL.
async function llmExtract(text, type) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      `That file isn't structured (CSV/JSON). Extracting from free text needs ANTHROPIC_API_KEY in .env.local — or convert the material to CSV using the headers in this script's help.`
    );
  }
  const model = process.env.SEED_LLM_MODEL || 'claude-haiku-4-5-20251001';
  const shapes = {
    jobs: '{"title","type"(Full-Time|Part-Time|Contract|Internship),"location","description","requirements":[..],"postedAt":"YYYY-MM-DD"}',
    articles: '{"title","subtitle","date":"YYYY-MM-DD","body"(markdown),"tags":[..],"author"?}',
    products: '{"title","category","description","specs":[{"label","value"}],"partNumber"?}',
    galleries: '{"url","alt"}',
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: `Extract ${type} from the client's material into a JSON array of ${shapes[type]}. Use ONLY facts present in the material — never invent details, prices, or dates. Omit fields the material doesn't supply. Respond with ONLY the JSON array.`,
      messages: [{ role: 'user', content: text.slice(0, 100000) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  if (data.usage) await recordApiCost(model, data.usage.input_tokens ?? 0, data.usage.output_tokens ?? 0, `Content extraction (${type})`);
  const out = data.content?.find((c) => c.type === 'text')?.text ?? '';
  return JSON.parse(out.slice(out.indexOf('['), out.lastIndexOf(']') + 1));
}

// ── Stage ────────────────────────────────────────────────────────────────
async function stage() {
  const file = opt('file');
  const type = opt('type');
  if (!file || !TYPES.includes(type)) usage();
  const galleryName = opt('gallery');
  if (type === 'galleries' && !galleryName) {
    console.error('Seeding galleries needs --gallery <name> (the gallery slug on the site).');
    process.exit(2);
  }

  const raw = fs.readFileSync(file, 'utf-8');
  const ext = path.extname(file).toLowerCase();
  let records;
  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    records = Array.isArray(parsed) ? parsed : [parsed];
  } else if (ext === '.csv') {
    records = parseCsv(raw);
  } else {
    console.log('Unstructured material; extracting with the LLM (facts only, still gated by your review)...');
    records = await llmExtract(raw, type);
  }

  const items = records.map(NORMALIZERS[type]).filter((it) => String(it[REQUIRED[type]]).trim() !== '');
  if (items.length === 0) throw new Error('No usable items found in that file.');

  fs.mkdirSync(path.join(SEEDS_DIR, slug), { recursive: true });
  const staged = { type, items, ...(galleryName ? { gallery: galleryName } : {}), source: path.basename(file), stagedAt: new Date().toISOString() };
  fs.writeFileSync(stagePath(type), JSON.stringify(staged, null, 2));

  console.log(`\nStaged ${items.length} ${type}${galleryName ? ` into gallery "${galleryName}"` : ''} (from ${path.basename(file)}):`);
  for (const it of items.slice(0, 10)) console.log(`  - ${it.title ?? it.url}`);
  if (items.length > 10) console.log(`  ... and ${items.length - 10} more`);
  console.log(`\nReview the full staged data: content/admin/seeds/${slug}/${type}.json`);
  console.log(`Then: npm run seed -- ${slug} --apply   (or --discard)`);
  await ledger('event', `Content seed staged for review: ${items.length} ${type} parsed from ${path.basename(file)}. Apply with: npm run seed -- ${slug} --apply`);
}

// ── Preview / discard ────────────────────────────────────────────────────
function stagedSeeds() {
  const dir = path.join(SEEDS_DIR, slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

function preview() {
  const seeds = stagedSeeds();
  if (seeds.length === 0) return console.log(`Nothing staged for ${slug}.`);
  for (const s of seeds) {
    console.log(`\n${s.type} (${s.items.length} items, from ${s.source}, staged ${s.stagedAt}):`);
    for (const it of s.items) console.log(`  - ${it.title ?? it.url}`);
  }
}

function discard() {
  const dir = path.join(SEEDS_DIR, slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  console.log(`Staged seeds for ${slug} discarded.`);
}

// ── Apply: merge into the client site's data store, never clobber ───────
async function apply() {
  const seeds = stagedSeeds();
  if (seeds.length === 0) throw new Error(`Nothing staged for ${slug}. Stage material first with --file/--type.`);
  const dataDir = path.join(REPO_ROOT, 'builds', slug, 'data');
  if (!fs.existsSync(path.join(REPO_ROOT, 'builds', slug))) throw new Error(`No build exists at builds/${slug} yet — build the site first.`);
  fs.mkdirSync(dataDir, { recursive: true });

  const readJson = (name, fallback) => {
    const fp = path.join(dataDir, `${name}.json`);
    try {
      return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf-8')) : fallback;
    } catch {
      return fallback;
    }
  };
  const writeJson = (name, data) => fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(data, null, 2));

  const summary = [];
  for (const s of seeds) {
    if (s.type === 'galleries') {
      const all = readJson('galleries', {});
      const existing = all[s.gallery] ?? [];
      const have = new Set(existing.map((i) => i.url));
      const fresh = s.items.filter((i) => !have.has(i.url));
      all[s.gallery] = [...existing, ...fresh];
      writeJson('galleries', all);
      summary.push(`${fresh.length} image(s) → gallery "${s.gallery}"`);
      continue;
    }
    const collection = s.type; // jobs / articles / products share the pattern
    const existing = readJson(collection, []);
    const have = new Set(existing.map((i) => i.id));
    const titles = new Set(existing.map((i) => (i.title ?? '').toLowerCase()));
    const fresh = s.items.filter((i) => !have.has(i.id) && !titles.has((i.title ?? '').toLowerCase()));
    writeJson(collection, [...existing, ...fresh]);
    summary.push(`${fresh.length} ${collection} added (${s.items.length - fresh.length} already present, skipped)`);

    // Products need their categories to exist for the filter UI.
    if (s.type === 'products') {
      const cats = readJson('catalog-categories', []);
      const haveCats = new Set(cats.map((c) => c.id));
      const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      for (const label of new Set(fresh.map((p) => p.category))) {
        const cid = slugify(label);
        if (!haveCats.has(cid) && !haveCats.has(label)) {
          cats.push({ id: cid, label });
          haveCats.add(cid);
        }
      }
      // Product.category must reference the category id.
      const byLabel = new Map(cats.map((c) => [c.label.toLowerCase(), c.id]));
      const patched = readJson(collection, []).map((p) => ({ ...p, category: byLabel.get(String(p.category).toLowerCase()) ?? p.category }));
      writeJson(collection, patched);
      writeJson('catalog-categories', cats);
    }
  }

  fs.rmSync(path.join(SEEDS_DIR, slug), { recursive: true, force: true });
  console.log(`\nApplied to builds/${slug}/data: ${summary.join('; ')}.`);
  console.log('Client content is read live — the running site picks it up on the next request. data/ is not in git by design (it belongs to the site, like uploads).');
  await ledger('event', `Content seed APPLIED after review: ${summary.join('; ')}. The client can refine everything through their /admin.`);
}

// ── Route ────────────────────────────────────────────────────────────────
(async () => {
  if (has('preview')) return preview();
  if (has('discard')) return discard();
  if (has('apply')) return apply();
  return stage();
})().catch((err) => {
  console.error(`\nSeed failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});

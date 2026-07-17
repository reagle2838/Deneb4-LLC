#!/usr/bin/env node
/**
 * Intake parser, CSV path (ROADMAP Phase 6). Turns an exported responses CSV
 * (one row per submission) into a PROPOSED build config for the Builder,
 * plus the client-contact record, decision flags, and a context bundle for
 * Ridhi. It proposes; Ridhi disposes: staged for review, never written
 * straight to content/build-configs/. Never invents a fact.
 *
 * The parsing is fully declarative: this script converts the CSV row into a
 * { header: cell } answers object and runs the SAME mapping the live intake
 * form uses — content/admin/intake-mapping.json, executed by
 * packages/field-mapping. Column headers start with the form's stable
 * Q-codes (Q3-1, Q7A-1, ...), which is all the engine needs; a keyword
 * fuzzy fallback plus the printed mapping report mean nothing is ever
 * silently missed. If the questionnaire changes, edit the MAPPING, not this
 * file.
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
import { runMapping, validateMapping, slugify } from '../packages/field-mapping/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const INTAKE_DIR = path.join(REPO_ROOT, 'content', 'admin', 'intake');
const BUILD_CONFIGS_DIR = path.join(REPO_ROOT, 'content', 'build-configs');
const MAPPING_PATH = path.join(REPO_ROOT, 'content', 'admin', 'intake-mapping.json');

const args = process.argv.slice(2);
const has = (n) => args.includes(`--${n}`);
const optOf = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const reportTo = (optOf('report-to') || 'http://localhost:3005').replace(/\/$/, '');

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

  // Row → answers object. On a duplicated header, the FIRST column wins
  // (same as the old first-match column scan).
  const answers = {};
  headers.forEach((h, i) => {
    if (!(h in answers)) answers[h] = String(record[i] ?? '').trim();
  });

  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf-8'));
  const valid = validateMapping(mapping);
  if (!valid.ok) {
    console.error('content/admin/intake-mapping.json is invalid:');
    for (const e of valid.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const result = runMapping(mapping, answers);
  const { config: cfg, contact, flags, unmapped, notes, context, mapReport } = result;

  const slug = optOf('slug') || slugify(cfg.siteName || `intake-${Date.now()}`);
  fs.mkdirSync(INTAKE_DIR, { recursive: true });
  const staged = {
    slug, config: cfg,
    clientContact: { name: contact.name ?? '', email: contact.email ?? '', phone: contact.phone ?? '' },
    flags, unmapped, notes, context,
    mapReport, source: path.basename(file), row: rowNum, stagedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(INTAKE_DIR, `${slug}.json`), JSON.stringify(staged, null, 2));

  // ── Report ───────────────────────────────────────────────────────────
  console.log(`\nStaged a proposed build config for "${cfg.siteName || slug}" (slug: ${slug}):\n`);
  console.log(JSON.stringify(cfg, null, 2));

  const fuzzy = mapReport.filter((m) => m.how === 'fuzzy');
  const missed = mapReport.filter((m) => m.how === 'none');
  console.log(`\nField mapping: ${mapReport.filter((m) => m.how === 'code').length} matched by exact code, ${fuzzy.length} by fuzzy fallback, ${missed.length} not found.`);
  if (fuzzy.length) console.log('  fuzzy-matched (verify): ' + fuzzy.map((m) => `${m.field} (${m.code})`).join(', '));
  if (missed.length) console.log('  NOT FOUND (column missing): ' + missed.map((m) => `${m.field} (${m.code})`).join(', '));

  if (unmapped.length) console.log(`\n⚠ Config fields the form didn't fill (add before building): ${unmapped.join(', ')}.`);
  if (staged.clientContact.name || staged.clientContact.email) {
    console.log(`\nClient contact: ${staged.clientContact.name || '(?)'} · ${staged.clientContact.email || '(?)'}${staged.clientContact.phone ? ' · ' + staged.clientContact.phone : ''}`);
  }
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

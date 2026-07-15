#!/usr/bin/env node
/**
 * Deploy a client's assembled site to the real stack: a Turso database
 * (their data layer) + a Vercel project (hosting), created on demand.
 * Deterministic API calls only; zero AI cost.
 *
 * Usage:
 *   node scripts/deploy-client.mjs <slug> [--dir <buildDir>] [--teardown]
 *
 * Or through the staging seam (scripts/deploy-staging.mjs):
 *   STAGING_DEPLOY_CMD="node <repo>/scripts/deploy-client.mjs"
 *   (slug/dir arrive as D4_SLUG / D4_OUT_DIR; the LAST url this script
 *   prints becomes the recorded staging URL.)
 *
 * What it does per client:
 *   1. Ensures Turso database `d4-<slug>` in the org (creates the group on
 *      first-ever use), mints a fresh DB auth token.
 *   2. Ensures Vercel project `d4-client-<slug>`; upserts env vars
 *      (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, ADMIN_PASSWORD on create).
 *   3. Deploys the build dir with the Vercel CLI (remote build).
 *   --teardown deletes the Vercel project and Turso database (test cleanup).
 *
 * Needs in .env.local: VERCEL_TOKEN, TURSO_API_TOKEN.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const file = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}
loadEnvLocal();

const args = process.argv.slice(2);
function opt(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const teardown = args.includes('--teardown');
const slug = args.find((a) => !a.startsWith('--')) || process.env.D4_SLUG;
const buildDir = path.resolve(opt('dir') || process.env.D4_OUT_DIR || path.join(REPO_ROOT, 'builds', slug ?? ''));

if (!slug || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
  console.error('Usage: node scripts/deploy-client.mjs <slug> [--dir <buildDir>] [--teardown]');
  process.exit(2);
}
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const TURSO_API_TOKEN = process.env.TURSO_API_TOKEN;
if (!VERCEL_TOKEN || !TURSO_API_TOKEN) {
  console.error('VERCEL_TOKEN and TURSO_API_TOKEN must be set in .env.local.');
  process.exit(2);
}

const DB_NAME = `d4-${slug}`.slice(0, 32).replace(/-+$/, '');
const PROJECT_NAME = `d4-client-${slug}`.slice(0, 52).replace(/-+$/, '');

// ── API helpers ──────────────────────────────────────────────────────────
async function api(base, token, method, pathname, body) {
  const res = await fetch(base + pathname, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text };
}
const turso = (method, p, body) => api('https://api.turso.tech', TURSO_API_TOKEN, method, p, body);
const vercel = (method, p, body) => api('https://api.vercel.com', VERCEL_TOKEN, method, p, body);

function fail(msg) {
  console.error(`\nDEPLOY FAILED: ${msg}\n`);
  process.exit(1);
}

// ── Turso ────────────────────────────────────────────────────────────────
async function tursoOrg() {
  const r = await turso('GET', '/v1/organizations');
  const orgs = r.json?.organizations ?? r.json;
  if (!r.ok || !Array.isArray(orgs) || orgs.length === 0) fail(`Turso organizations lookup failed (${r.status}): ${r.text.slice(0, 200)}`);
  return orgs[0].slug;
}

async function ensureTursoDb(org) {
  const existing = await turso('GET', `/v1/organizations/${org}/databases/${DB_NAME}`);
  if (existing.ok) {
    console.log(`Turso database ${DB_NAME} already exists.`);
    return existing.json.database;
  }
  // Groups: required for creation; create the default group on first use,
  // in the first available US-East location (or whatever the API offers).
  const groups = await turso('GET', `/v1/organizations/${org}/groups`);
  let group = groups.json?.groups?.[0]?.name;
  if (!group) {
    const locs = await turso('GET', '/v1/locations');
    const available = Object.keys(locs.json?.locations ?? {});
    const location = available.find((l) => l.includes('us-east')) ?? available[0];
    if (!location) fail(`No Turso locations available (${locs.status}): ${locs.text.slice(0, 200)}`);
    console.log(`No Turso group yet; creating "default" (${location})...`);
    const g = await turso('POST', `/v1/organizations/${org}/groups`, { name: 'default', location });
    if (!g.ok) fail(`Turso group creation failed (${g.status}): ${g.text.slice(0, 200)}`);
    group = 'default';
  }
  console.log(`Creating Turso database ${DB_NAME} (group ${group})...`);
  const r = await turso('POST', `/v1/organizations/${org}/databases`, { name: DB_NAME, group });
  if (!r.ok) fail(`Turso database creation failed (${r.status}): ${r.text.slice(0, 200)}`);
  return r.json.database;
}

async function mintDbToken(org) {
  const r = await turso('POST', `/v1/organizations/${org}/databases/${DB_NAME}/auth/tokens`, {});
  if (!r.ok || !r.json?.jwt) fail(`Turso token mint failed (${r.status}): ${r.text.slice(0, 200)}`);
  return r.json.jwt;
}

// ── Vercel ───────────────────────────────────────────────────────────────
async function ensureVercelProject() {
  const existing = await vercel('GET', `/v9/projects/${PROJECT_NAME}`);
  if (existing.ok) {
    console.log(`Vercel project ${PROJECT_NAME} already exists.`);
    return { project: existing.json, created: false };
  }
  console.log(`Creating Vercel project ${PROJECT_NAME}...`);
  const r = await vercel('POST', '/v10/projects', { name: PROJECT_NAME, framework: 'nextjs' });
  if (!r.ok) fail(`Vercel project creation failed (${r.status}): ${r.text.slice(0, 300)}`);
  return { project: r.json, created: true };
}

async function upsertEnv(projectId, entries) {
  const payload = entries.map(([key, value]) => ({
    key,
    value,
    type: 'encrypted',
    target: ['production', 'preview'],
  }));
  const r = await vercel('POST', `/v10/projects/${projectId}/env?upsert=true`, payload);
  if (!r.ok) fail(`Vercel env upsert failed (${r.status}): ${r.text.slice(0, 300)}`);
}

async function hasEnvVar(projectId, key) {
  const r = await vercel('GET', `/v9/projects/${projectId}/env`);
  return r.ok && (r.json?.envs ?? []).some((e) => e.key === key);
}

// ── Deploy via CLI (remote build) ────────────────────────────────────────
function runVercelDeploy(projectId, orgId) {
  const vercelDir = path.join(buildDir, '.vercel');
  fs.mkdirSync(vercelDir, { recursive: true });
  fs.writeFileSync(path.join(vercelDir, 'project.json'), JSON.stringify({ projectId, orgId }, null, 2));
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes', '--token', VERCEL_TOKEN],
      { cwd: buildDir, shell: true, env: { ...process.env } }
    );
    let out = '';
    child.stdout.on('data', (d) => { process.stdout.write(d); out += d; });
    child.stderr.on('data', (d) => { process.stderr.write(d); out += d; });
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`vercel deploy exit ${code}`))));
    child.on('error', reject);
  });
}

// ── Teardown (test cleanup) ──────────────────────────────────────────────
async function runTeardown(org) {
  const p = await vercel('DELETE', `/v9/projects/${PROJECT_NAME}`);
  console.log(`Vercel project ${PROJECT_NAME}: ${p.ok ? 'deleted' : `delete returned ${p.status}`}`);
  const d = await turso('DELETE', `/v1/organizations/${org}/databases/${DB_NAME}`);
  console.log(`Turso database ${DB_NAME}: ${d.ok ? 'deleted' : `delete returned ${d.status}`}`);
}

// ── Main ─────────────────────────────────────────────────────────────────
(async () => {
  const org = await tursoOrg();

  if (teardown) return runTeardown(org);

  if (!fs.existsSync(path.join(buildDir, 'package.json'))) {
    fail(`No build at ${buildDir}. Assemble/build the client first.`);
  }

  const db = await ensureTursoDb(org);
  const hostname = db?.Hostname || db?.hostname;
  if (!hostname) fail(`Turso database response had no hostname: ${JSON.stringify(db).slice(0, 200)}`);
  const dbUrl = `libsql://${hostname}`;
  const dbToken = await mintDbToken(org);
  console.log(`Turso ready: ${dbUrl}`);

  const { project, created } = await ensureVercelProject();
  const projectId = project.id;
  const orgId = project.accountId;

  const envEntries = [
    ['TURSO_DATABASE_URL', dbUrl],
    ['TURSO_AUTH_TOKEN', dbToken],
  ];
  if (created || !(await hasEnvVar(projectId, 'ADMIN_PASSWORD'))) {
    const adminPassword = crypto.randomBytes(12).toString('base64url');
    envEntries.push(['ADMIN_PASSWORD', adminPassword]);
    console.log(`Generated ADMIN_PASSWORD for ${slug} (save it; it is not stored locally): ${adminPassword}`);
  }
  await upsertEnv(projectId, envEntries);
  console.log(`Vercel env ready on ${PROJECT_NAME}.`);

  const output = await runVercelDeploy(projectId, orgId);
  const urls = output.match(/https?:\/\/[^\s"']+\.vercel\.app/g) ?? [];
  if (urls.length === 0) fail('Deploy finished but no deployment URL found in CLI output.');

  // Print the stable production alias LAST: the staging seam records the
  // last URL printed, and the per-deployment hash URL may be protected.
  console.log(`\nDeployed ${slug}:`);
  console.log(`https://${PROJECT_NAME}.vercel.app`);
})().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});

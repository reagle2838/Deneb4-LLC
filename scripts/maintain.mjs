#!/usr/bin/env node
/**
 * The Maintenance agent's ACTING half (ROADMAP Phase 7: "detect, patch,
 * run harness, green ships / red escalates") — deliberately NOT on the
 * heartbeat. Widest blast radius, tightest leash: it only runs when
 * invoked, it never force-upgrades across breaking versions, and a patch
 * that fails the full QA battery is git-reverted automatically.
 *
 * Usage:
 *   npm run maintain -- [<slug>] [--fix] [--report-to http://localhost:3005] [--port 4183]
 *
 *   (no slug)   audit every client repo under builds/
 *   --fix       apply `npm audit fix` (no --force, ever), then build + full
 *               QA (incl. browser checks); green = commit kept + pushed
 *               (token-gated), red = reverted + escalated
 *
 * Exit 0 = clean/fixed, 1 = vulnerabilities remain or a fix was reverted.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, BUILDS_DIR, deriveQaManifest, gitIsDirty, gitCommitAll, gitRevertHead, maybePushToGitHub } from './builder/d4.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const file = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const args = process.argv.slice(2);
const slugArg = args.find((a) => !a.startsWith('--'));
const fix = args.includes('--fix');
const optOf = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const reportTo = (optOf('report-to') || '').replace(/\/$/, '');
const port = Number(optOf('port')) || 4183;
const agentKey = process.env.AGENT_API_KEY || '';

// Same nested-Next hygiene as the Builder: never let a parent dev server's
// env leak into a client build.
const cleanEnv = { ...process.env, NODE_OPTIONS: '--use-system-ca' };
for (const key of Object.keys(cleanEnv)) {
  if (/^(__NEXT|NEXT_|TURBOPACK)/i.test(key)) delete cleanEnv[key];
}
delete cleanEnv.NODE_ENV;
delete cleanEnv.PORT;

async function ledger(slug, kind, message, data) {
  if (!reportTo) return;
  try {
    await fetch(`${reportTo}/api/agents/ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
      body: JSON.stringify({ channel: slug, agent: 'maintenance', kind, message, data: data || {} }),
    });
  } catch {
    /* console is the fallback record */
  }
}

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit', ...opts });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

function npmJson(cmdArgs, cwd) {
  // npm exits non-zero when it has findings; the JSON on stdout is still good.
  try {
    return JSON.parse(execFileSync('npm', cmdArgs, { cwd, env: cleanEnv, shell: true, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (err) {
    try {
      return JSON.parse(err.stdout ?? '');
    } catch {
      return null;
    }
  }
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status > 0) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/** Full build + serve + QA battery on the repo. Returns true when green. */
async function qaPasses(slug, outDir) {
  const nextBin = path.join(outDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  console.log('\nnext build...');
  if ((await run('node', [nextBin, 'build'], { cwd: outDir, env: cleanEnv })) !== 0) return false;
  console.log(`Serving on :${port} for QA...`);
  const server = spawn('node', [nextBin, 'start', '-p', String(port)], { cwd: outDir, env: cleanEnv, stdio: 'ignore' });
  try {
    if (!(await waitForServer(`http://127.0.0.1:${port}/`))) return false;
    const qa = deriveQaManifest(outDir);
    const verifyArgs = [
      path.join(HERE, 'verify.mjs'),
      `http://127.0.0.1:${port}`,
      '--manifest', qa.file,
      '--qa-dir', path.join(BUILDS_DIR, '.qa', slug),
    ];
    if (reportTo) verifyArgs.push('--client', slug, '--key', agentKey, '--report-to', reportTo);
    return (await run('node', verifyArgs)) === 0;
  } finally {
    server.kill();
  }
}

const SEV_ORDER = ['critical', 'high', 'moderate', 'low', 'info'];

async function auditOne(slug) {
  const outDir = path.join(BUILDS_DIR, slug);
  console.log(`\n=== ${slug} ===`);

  const audit = npmJson(['audit', '--json', '--no-fund'], outDir);
  const vulns = audit?.metadata?.vulnerabilities ?? {};
  const total = SEV_ORDER.reduce((n, s) => n + (vulns[s] ?? 0), 0);
  const vulnLine = total === 0 ? 'no known vulnerabilities' : SEV_ORDER.filter((s) => vulns[s]).map((s) => `${vulns[s]} ${s}`).join(', ');

  const outdated = npmJson(['outdated', '--json'], outDir) ?? {};
  const outdatedCount = Object.keys(outdated).length;

  console.log(`audit: ${vulnLine}; ${outdatedCount} outdated package(s).`);
  const urgent = (vulns.critical ?? 0) + (vulns.high ?? 0);

  if (!fix) {
    await ledger(slug, urgent > 0 ? 'alert' : 'event', `Dependency audit: ${vulnLine}; ${outdatedCount} outdated. ${urgent > 0 ? `Run \`npm run maintain -- ${slug} --fix\` to patch with the QA safety net.` : 'Nothing urgent.'}`);
    return { slug, total, urgent, fixed: false };
  }

  // ── The leashed fix path ────────────────────────────────────────────
  if (total === 0) {
    console.log('Nothing to fix.');
    return { slug, total, urgent, fixed: false };
  }
  if (gitIsDirty(outDir)) {
    console.error('Repo has uncommitted changes; commit or clean them before maintenance patches.');
    await ledger(slug, 'alert', 'Maintenance fix refused: the client repo has uncommitted changes.');
    return { slug, total, urgent, fixed: false, refused: true };
  }

  console.log('npm audit fix (no --force: never crosses breaking versions)...');
  await run('npm', ['audit', 'fix', '--no-fund', '--no-audit'], { cwd: outDir, env: cleanEnv, shell: true });
  if (!gitIsDirty(outDir)) {
    console.log('audit fix changed nothing (remaining issues need a breaking upgrade — escalating, not forcing).');
    await ledger(slug, 'alert', `Dependency audit found ${vulnLine}, but nothing is fixable without a breaking upgrade. That change is yours to schedule (Cowork session against the repo).`);
    return { slug, total, urgent, fixed: false };
  }

  const sha = gitCommitAll(outDir, `Maintenance: npm audit fix (was: ${vulnLine})`);
  console.log(`Patch committed as ${sha}; running the full QA battery...`);

  if (await qaPasses(slug, outDir)) {
    const push = maybePushToGitHub(slug, outDir);
    const after = npmJson(['audit', '--json', '--no-fund'], outDir)?.metadata?.vulnerabilities ?? {};
    const remaining = SEV_ORDER.reduce((n, s) => n + (after[s] ?? 0), 0);
    await ledger(slug, 'event', `Maintenance patch shipped (${sha}): dependencies updated, QA green. ${remaining === 0 ? 'Audit is now clean.' : `${remaining} issue(s) remain and need a breaking upgrade — flagged for you.`} ${push?.detail ?? ''}`);
    console.log('QA green — patch kept.');
    return { slug, total, urgent, fixed: true };
  }

  const revertSha = gitRevertHead(outDir);
  console.log(`QA FAILED — patch reverted (${revertSha}). Restoring node_modules to match...`);
  await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: outDir, env: cleanEnv, shell: true });
  await ledger(slug, 'alert', `Maintenance patch REVERTED (${revertSha}): the dependency update broke the QA battery. The site is back at its last good state; the update needs your eyes (Cowork session).`);
  return { slug, total, urgent, fixed: false, reverted: true };
}

async function main() {
  const slugs = slugArg
    ? [slugArg]
    : fs.existsSync(BUILDS_DIR)
      ? fs.readdirSync(BUILDS_DIR).filter((d) => fs.existsSync(path.join(BUILDS_DIR, d, '.git')))
      : [];
  if (slugs.length === 0) {
    console.error(slugArg ? `No client repo at builds/${slugArg}.` : 'No client repos under builds/.');
    process.exit(2);
  }
  if (slugArg && !fs.existsSync(path.join(BUILDS_DIR, slugArg, '.git'))) {
    console.error(`No client repo at builds/${slugArg}.`);
    process.exit(2);
  }

  const results = [];
  for (const slug of slugs) results.push(await auditOne(slug));

  const unhealthy = results.filter((r) => (r.total > 0 && !r.fixed) || r.reverted || r.refused);
  console.log(`\n${'='.repeat(50)}\nFleet: ${results.length} repo(s), ${unhealthy.length} needing attention.`);
  process.exitCode = unhealthy.length > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(`Maintenance run failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});

#!/usr/bin/env node
/**
 * Staging deploy (ROADMAP Phase 4): get a finished build onto a URL and
 * record that URL on the client's record, closing the gap between "QA
 * green" and "the client can look at it".
 *
 * Two providers:
 *
 * 1. HOST SEAM (`STAGING_DEPLOY_CMD` in .env.local): any real host plugs in
 *    with one command — it runs with D4_SLUG/D4_OUT_DIR in its env, does
 *    whatever the host needs (Hostinger API, vercel deploy, rsync...), and
 *    prints the staging URL on stdout. The last http(s):// URL it prints is
 *    recorded. Nothing else here changes when the host decision is made.
 *
 * 2. LOCAL provider (default, zero credentials): builds and runs the site
 *    as a persistent background process on a per-client port (4200-4299),
 *    records http://127.0.0.1:<port>. That's a real staging target for
 *    Ridhi's internal review TODAY (the Workspace "Open staging" button and
 *    the uptime watch both use it); swap in the host seam for client-facing
 *    URLs. Processes don't survive a reboot — redeploy brings one back.
 *
 * Usage:
 *   npm run deploy -- <slug> [--report-to http://localhost:3005] [--no-build] [--stop]
 *
 * Exit 0 = deployed (or stopped), non-zero = failed.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const BUILDS_DIR = path.join(REPO_ROOT, 'builds');
const STATE_DIR = path.join(BUILDS_DIR, '.staging');

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
const slug = args.find((a) => !a.startsWith('--'));
const optOf = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const reportTo = (optOf('report-to') || 'http://localhost:3005').replace(/\/$/, '');
const noBuild = args.includes('--no-build');
const stop = args.includes('--stop');
const agentKey = process.env.AGENT_API_KEY || '';

if (!slug) {
  console.error('Usage: npm run deploy -- <slug> [--report-to <origin>] [--no-build] [--stop]');
  process.exit(2);
}
const outDir = path.join(BUILDS_DIR, slug);
if (!fs.existsSync(path.join(outDir, 'package.json'))) {
  console.error(`No build at builds/${slug}. Build the site first: npm run builder -- ${slug} --report-to ${reportTo}`);
  process.exit(2);
}

// Nested-Next hygiene (same as the Builder).
const cleanEnv = { ...process.env, NODE_OPTIONS: '--use-system-ca' };
for (const key of Object.keys(cleanEnv)) {
  if (/^(__NEXT|NEXT_|TURBOPACK)/i.test(key)) delete cleanEnv[key];
}
delete cleanEnv.NODE_ENV;
delete cleanEnv.PORT;

async function writeback(patch) {
  try {
    const res = await fetch(`${reportTo}/api/agents/staging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
      body: JSON.stringify({ slug, agent: 'builder', ...patch }),
    });
    const data = await res.json();
    if (!data.ok) console.error(`Staging writeback refused: ${data.error ?? res.status}`);
    else console.log(`Recorded on ${slug}'s record: ${patch.url ?? ''} (${patch.status}).`);
  } catch (err) {
    console.error(`Staging writeback failed (${err instanceof Error ? err.message : err}) — the deploy itself still stands.`);
  }
}

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit', ...opts });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
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

// ── Local provider process bookkeeping ───────────────────────────────────
const stateFile = path.join(STATE_DIR, `${slug}.json`);
const portFor = (s) => 4200 + (crypto.createHash('sha1').update(s).digest()[0] % 100);

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  } catch {
    return null;
  }
}

function killExisting() {
  const state = readState();
  if (!state?.pid) return false;
  try {
    process.kill(state.pid);
    console.log(`Stopped previous staging process (pid ${state.pid}).`);
    return true;
  } catch {
    return false; // already gone
  }
}

async function stopLocal() {
  const stopped = killExisting();
  if (fs.existsSync(stateFile)) fs.rmSync(stateFile);
  await writeback({ status: 'down', notes: 'Staging stopped.' });
  console.log(stopped ? 'Staging stopped.' : 'No staging process was running; status recorded as down.');
}

async function deployLocal() {
  const port = portFor(slug);
  killExisting();

  if (!noBuild) {
    console.log('next build...');
    const nextBin = path.join(outDir, 'node_modules', 'next', 'dist', 'bin', 'next');
    const code = await run('node', [nextBin, 'build'], { cwd: outDir, env: cleanEnv });
    if (code !== 0) throw new Error(`next build failed (exit ${code}).`);
  } else if (!fs.existsSync(path.join(outDir, '.next', 'BUILD_ID'))) {
    throw new Error('--no-build passed but no existing production build found.');
  }

  const nextBin = path.join(outDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn('node', [nextBin, 'start', '-p', String(port)], {
    cwd: outDir,
    env: cleanEnv,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const url = `http://127.0.0.1:${port}`;
  if (!(await waitForServer(`${url}/`))) {
    try { process.kill(child.pid); } catch { /* already dead */ }
    throw new Error('Staging process did not come up within 60s.');
  }

  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ pid: child.pid, port, startedAt: new Date().toISOString() }, null, 2));
  console.log(`Staging up at ${url} (pid ${child.pid}).`);
  await writeback({ url, status: 'ready', notes: 'Local staging (this machine). Swap in STAGING_DEPLOY_CMD for a public host.' });
}

// ── Host seam ────────────────────────────────────────────────────────────
async function deployViaHost(cmd) {
  console.log(`Deploying via STAGING_DEPLOY_CMD...`);
  const output = await new Promise((resolve, reject) => {
    const child = spawn(cmd, {
      cwd: outDir,
      env: { ...cleanEnv, D4_SLUG: slug, D4_OUT_DIR: outDir },
      shell: true,
    });
    let buf = '';
    child.stdout.on('data', (d) => {
      process.stdout.write(d);
      buf += d;
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('close', (code) => (code === 0 ? resolve(buf) : reject(new Error(`deploy command exit ${code}`))));
    child.on('error', reject);
  });
  const urls = output.match(/https?:\/\/[^\s"']+/g) ?? [];
  const url = urls[urls.length - 1];
  if (!url) throw new Error('Deploy command succeeded but printed no URL; cannot record staging.');
  await writeback({ url, status: 'ready', notes: 'Deployed via STAGING_DEPLOY_CMD.' });
}

(async () => {
  if (stop) return stopLocal();
  const hostCmd = process.env.STAGING_DEPLOY_CMD;
  if (hostCmd) return deployViaHost(hostCmd);
  return deployLocal();
})().catch((err) => {
  console.error(`\nDeploy failed: ${err instanceof Error ? err.message : err}`);
  writeback({ status: 'down', notes: `Deploy failed: ${err instanceof Error ? err.message : err}`.slice(0, 400) }).finally(() => {
    process.exitCode = 1;
  });
});

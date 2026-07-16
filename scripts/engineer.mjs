#!/usr/bin/env node
/**
 * The Engineer's runner (docs/agents.md 2026-07-16): executes ONE work
 * order on an isolated branch of a client's built repo, then QAs it.
 *
 *   node scripts/engineer.mjs <slug> <orderId> --report-to <origin> [--engine sdk|dry] [--port 4184]
 *
 * Engine 'sdk' (default): @anthropic-ai/claude-agent-sdk drives the coding,
 * headless, cwd-scoped to the client build, capped turns, cost recorded via
 * the billing API (needs ANTHROPIC_API_KEY). Engine 'dry': a scripted
 * trivial edit, so the whole pipeline (branch → commit → QA → review →
 * merge) is testable without a key.
 *
 * Doctrine (same as the Builder/Maintenance runners): work on a branch,
 * never leave the repo off main, QA before anyone sees it, keep the branch
 * on failure (escalate with partial work), alert-and-stop over guessing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, BUILDS_DIR, deriveQaManifest } from './builder/d4.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ── Env from .env.local (quotes stripped — the documented gotcha) ───────
const envFile = path.join(REPO_ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const args = process.argv.slice(2);
const optOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : '';
};
const [slug, orderId] = args.filter((a) => !a.startsWith('--') && a !== optOf('report-to') && a !== optOf('engine') && a !== optOf('port'));
const reportTo = (optOf('report-to') || '').replace(/\/$/, '');
const engine = optOf('engine') || process.env.ENGINEER_ENGINE || 'sdk';
const port = Number(optOf('port')) || 4184;
const agentKey = process.env.AGENT_API_KEY || '';

if (!slug || !orderId) {
  console.error('Usage: node scripts/engineer.mjs <slug> <orderId> --report-to <origin> [--engine sdk|dry]');
  process.exit(2);
}

const outDir = path.join(BUILDS_DIR, slug);
const branch = `engineer/${orderId}`;

const cleanEnv = { ...process.env, NODE_OPTIONS: '--use-system-ca' };
for (const key of Object.keys(cleanEnv)) {
  if (/^(__NEXT|NEXT_|TURBOPACK)/i.test(key)) delete cleanEnv[key];
}
delete cleanEnv.NODE_ENV;
delete cleanEnv.PORT;

const git = (a) => execFileSync('git', a, { cwd: outDir, encoding: 'utf-8' }).trim();

async function api(body) {
  if (!reportTo) return;
  try {
    await fetch(`${reportTo}/api/agents/engineer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
      body: JSON.stringify({ slug, id: orderId, action: 'update', ...body }),
    });
  } catch { /* the ledger call below is the louder channel */ }
}

async function ledger(kind, message) {
  if (!reportTo) return;
  try {
    await fetch(`${reportTo}/api/agents/ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
      body: JSON.stringify({ channel: slug, agent: 'engineer', kind, message }),
    });
  } catch { /* console fallback */ }
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

/** Compact build + serve + QA (maintain.mjs's deliberate-duplication pattern). */
async function qaPasses() {
  const nextBin = path.join(outDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  if ((await run('node', [nextBin, 'build'], { cwd: outDir, env: cleanEnv })) !== 0) return false;
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

// ── Engines ──────────────────────────────────────────────────────────────

async function readOrderSpec() {
  const file = path.join(REPO_ROOT, 'content', 'admin', 'work-orders', `${slug}.json`);
  const orders = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const order = orders.find((o) => o.id === orderId);
  if (!order) throw new Error(`Work order ${orderId} not found for ${slug}.`);
  return order.spec;
}

async function engineDry(spec) {
  // Scripted trivial edit: pipeline testing without an API key. Appends a
  // build note to the About page (or README fallback).
  const target = ['src/app/about/page.tsx', 'README.md'].map((p) => path.join(outDir, p)).find(fs.existsSync);
  if (!target) throw new Error('dry engine: no editable target file found.');
  fs.appendFileSync(target, `\n{/* Engineer dry-run marker: order ${orderId} — spec: ${spec.slice(0, 60).replace(/\*\//g, '')} */}\n`);
  return { summary: `Dry engine: appended a marker comment to ${path.relative(outDir, target)}.`, costUsd: 0 };
}

async function engineSdk(spec) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — the Engineer\'s coding engine needs it. Add it to .env.local (the dry engine remains available for pipeline tests).');
  }
  const { query } = await import('@anthropic-ai/claude-agent-sdk');
  const model = process.env.ENGINEER_MODEL || 'claude-sonnet-5';
  const prompt = [
    `You are the Engineer agent for a small web studio, executing ONE approved work order on a client's Next.js website repository (your current working directory).`,
    ``,
    `WORK ORDER:`,
    spec,
    ``,
    `Constraints (hard rules):`,
    `- Change only what the work order asks for; match the repo's existing conventions.`,
    `- Do not add npm dependencies unless the task is impossible without one.`,
    `- Never read or modify .env files, .git internals, or anything outside this repository.`,
    `- Do not run servers, deploys, or git commands — the orchestrator handles commit, QA, and review.`,
    `- When done, summarize what you changed and why in your final message.`,
  ].join('\n');

  let resultText = '';
  let costUsd = 0;
  const q = query({
    prompt,
    options: {
      cwd: outDir,
      model,
      permissionMode: 'bypassPermissions',
      maxTurns: 40,
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
    },
  });
  for await (const message of q) {
    if (message.type === 'result') {
      resultText = message.subtype === 'success' ? message.result : `Engine ended: ${message.subtype}`;
      costUsd = message.total_cost_usd ?? 0;
    }
  }
  if (costUsd > 0 && reportTo) {
    try {
      await fetch(`${reportTo}/api/agents/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
        body: JSON.stringify({ slug, action: 'record-cost', kind: 'build-api', amount: costUsd, note: `Engineer order ${orderId} (${model})` }),
      });
    } catch { /* cost note best-effort; the run itself is the record */ }
  }
  return { summary: resultText.slice(0, 1500) || 'Engine finished without a summary.', costUsd };
}

// ── Main ────────────────────────────────────────────────────────────────

async function fail(reason, { keepBranch = true } = {}) {
  console.error(`\nENGINEER FAILED: ${reason}`);
  try { git(['checkout', 'main']); } catch { /* best effort */ }
  if (!keepBranch) { try { git(['branch', '-D', branch]); } catch { /* absent */ } }
  await api({ status: 'failed', note: reason.slice(0, 900) });
  await ledger('alert', `Work order ${orderId} FAILED: ${reason}${keepBranch ? ` Partial work is preserved on ${branch}.` : ''}`);
  process.exit(1);
}

try {
  if (!fs.existsSync(path.join(outDir, '.git'))) throw new Error(`builds/${slug} is not a git repo.`);
  if (git(['status', '--porcelain']).length > 0) throw new Error('Client repo has uncommitted changes; refusing to start.');

  const spec = await readOrderSpec();
  await api({ status: 'running' });

  git(['checkout', 'main']);
  git(['checkout', '-b', branch]);

  const { summary } = await (engine === 'dry' ? engineDry(spec) : engineSdk(spec));

  // Safety caps before anything is committed.
  const changed = git(['status', '--porcelain']).split(/\r?\n/).filter(Boolean);
  if (changed.length === 0) await fail('The engine made no changes — the work order may need more detail.', { keepBranch: false });
  if (changed.length > 40) await fail(`Touched ${changed.length} files (cap is 40) — too broad for an unattended change.`);
  const forbidden = changed.filter((l) => /(^|\s|")\.?env|\.git\//i.test(l.slice(3)));
  if (forbidden.length > 0) await fail(`Change touches forbidden paths: ${forbidden.map((l) => l.slice(3)).join(', ')}.`);

  const specLine = spec.split(/\r?\n/)[0].slice(0, 80);
  git(['add', '-A']);
  git(['-c', 'user.name=Deneb4 Engineer', '-c', 'user.email=agents@deneb4.com', 'commit', '--quiet', '-m', `Engineer: ${specLine} (order ${orderId})`]);
  const diffstat = git(['diff', '--stat', 'main...HEAD']).split(/\r?\n/).slice(-1)[0] || `${changed.length} file(s) changed`;

  console.log('\nQA battery...');
  const green = await qaPasses();
  // The QA run leaves build artifacts; keep the branch tree clean for review.
  git(['checkout', '.']);
  git(['clean', '-fd', '--exclude=node_modules', '--exclude=.next']);
  git(['checkout', 'main']);

  if (!green) {
    await fail('QA rejected the change (see the QA alert for specifics).');
  }

  await api({ status: 'review', summary, diffstat });
  await ledger(
    'alert',
    `Work order ${orderId} is READY FOR YOUR REVIEW (QA green). ${diffstat}. Summary: ${summary.slice(0, 400)} — Approve & merge or Reject on the Engineer panel.`
  );
  console.log(`\nOrder ${orderId}: QA green, awaiting review on branch ${branch}.`);
  process.exit(0);
} catch (err) {
  await fail(err instanceof Error ? err.message : String(err));
}

#!/usr/bin/env node
/**
 * The Builder agent, v2: git-native, driving Ridhi's real d4-site-builder
 * ecosystem (github.com/deneb4admin).
 *
 * Flow: read the client's pipeline stage (read-before-acting; refuse past a
 * gate) -> mirror the d4 repos (recording exact SHAs) -> assemble via
 * d4-site-builder -> generate ADMIN_PASSWORD env -> git init + initial
 * commit (each client site is its own repo) -> token-gated GitHub push ->
 * npm install -> next build -> next start -> QA harness against the real
 * app -> green: change summary to the client's ledger + advance pipeline to
 * internal-review (Ridhi's gate) and STOP -> any failure: escalate (alert
 * email) and stay at `building`.
 *
 * All agent interactions go over HTTP with x-agent-key, because the
 * escalation email and auto-logged handoff only fire through the API routes.
 *
 * Usage:
 *   node scripts/build-client.mjs <slug> --report-to http://localhost:3005 [--port 4181]
 *   node scripts/build-client.mjs <slug> --assemble-only     # mirror+assemble+git only
 *
 * Exit 0 = built + QA green + advanced to gate; non-zero = refused/failed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT,
  ensureMirror,
  loadBuildConfig,
  assemble,
  deriveQaManifest,
  writeEnvLocal,
  gitInitCommit,
  maybePushToGitHub,
} from './builder/d4.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local (AGENT_API_KEY, optional GITHUB_TOKEN/GITHUB_OWNER).
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
const reportTo = (optOf('report-to') || '').replace(/\/$/, '');
const port = Number(optOf('port')) || 4181;
const assembleOnly = args.includes('--assemble-only');
const agentKey = process.env.AGENT_API_KEY || '';

if (!slug) {
  console.error('Usage: node scripts/build-client.mjs <slug> --report-to <origin> [--port 4181] [--assemble-only]');
  process.exit(2);
}

async function ledger(kind, message, data) {
  if (!reportTo) return;
  try {
    await fetch(`${reportTo}/api/agents/ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
      body: JSON.stringify({ channel: slug, agent: 'builder', kind, message, data: data || {} }),
    });
  } catch (err) {
    console.error('ledger post failed:', err instanceof Error ? err.message : err);
  }
}

async function readStage() {
  const res = await fetch(`${reportTo}/api/agents/pipeline?client=${slug}`, {
    headers: { 'x-agent-key': agentKey },
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`pipeline GET ${res.status}`);
  return res.json();
}

async function advanceToGate() {
  const res = await fetch(`${reportTo}/api/agents/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
    body: JSON.stringify({
      client: slug,
      stage: 'internal-review',
      agent: 'builder',
      note: 'Assembled from the d4 templates + QA green; ready for design + copy review.',
    }),
  });
  return res.json();
}

/** Run a command to completion, streaming output. Resolves to exit code. */
function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit', ...opts });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(`${cmd} failed to start:`, err.message);
      resolve(1);
    });
  });
}

/** Poll until the started site answers, or time out. */
async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function main() {
  // 1. Guard (skipped in assemble-only mode, which does no HTTP).
  if (!assembleOnly) {
    if (!reportTo) {
      console.error('Missing --report-to <origin>. Use --assemble-only to skip agent wiring.');
      return 2;
    }
    if (!agentKey) {
      console.error('AGENT_API_KEY not found (checked env + .env.local).');
      return 2;
    }
    let stageInfo;
    try {
      stageInfo = await readStage();
    } catch (err) {
      console.error('Could not read pipeline:', err instanceof Error ? err.message : err);
      return 2;
    }
    if (stageInfo.notFound) {
      console.error(`Client "${slug}" not found. Create it (and set pipeline to "building") first.`);
      return 2;
    }
    if (stageInfo.gated) {
      console.error(`Refusing: "${slug}" is at a gated stage (${stageInfo.label}). The Builder never acts past a gate.`);
      return 1;
    }
    if (stageInfo.stage !== 'building') {
      console.error(`Refusing: "${slug}" is at "${stageInfo.stage}", not "building". Move it to building first.`);
      return 1;
    }
  }

  // 2. Mirror + assemble + env + git (failures here escalate).
  let outDir;
  let shas;
  let qa;
  let commitSha;
  let pushResult;
  try {
    console.log('Mirroring d4 template repos...');
    shas = ensureMirror();
    const cfg = loadBuildConfig(slug);
    console.log(`Assembling "${cfg.siteName}" (modules: ${cfg.modules.join(', ')})...`);
    outDir = await assemble(slug, cfg);
    writeEnvLocal(outDir);
    qa = deriveQaManifest(outDir);
    commitSha = gitInitCommit(outDir, `Initial assembly: ${cfg.siteName} (${cfg.modules.join(', ')})`);
    console.log(`Client repo initialized at builds/${slug} (commit ${commitSha}).`);
    pushResult = await maybePushToGitHub(slug, outDir);
    console.log(pushResult.detail);
  } catch (err) {
    const msg = `Builder failed before QA: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    await ledger('alert', msg, { phase: 'assemble' });
    return 1;
  }

  if (assembleOnly) {
    console.log('Assemble-only: skipping install/build/QA/agent wiring.');
    console.log(`Output: ${outDir}`);
    return 0;
  }

  // 3. Install + build + serve + QA (the real Next app).
  let server;
  try {
    const buildEnv = { ...process.env, NODE_OPTIONS: '--use-system-ca' };

    console.log('\nnpm install (this takes a few minutes on first run)...');
    const installCode = await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: outDir, env: buildEnv, shell: true });
    if (installCode !== 0) throw new Error(`npm install failed (exit ${installCode}).`);

    console.log('\nnext build...');
    const nextBin = path.join(outDir, 'node_modules', 'next', 'dist', 'bin', 'next');
    const buildCode = await run('node', [nextBin, 'build'], { cwd: outDir, env: buildEnv });
    if (buildCode !== 0) throw new Error(`next build failed (exit ${buildCode}).`);

    console.log(`\nStarting the site on :${port} for QA...`);
    server = spawn('node', [nextBin, 'start', '-p', String(port)], { cwd: outDir, env: buildEnv, stdio: 'ignore' });
    const up = await waitForServer(`http://127.0.0.1:${port}/`);
    if (!up) throw new Error('Assembled site did not start within 60s.');

    const qaCode = await run('node', [
      path.join(HERE, 'verify.mjs'),
      `http://127.0.0.1:${port}`,
      '--manifest', qa.file,
      '--client', slug,
      '--key', agentKey,
      '--report-to', reportTo,
    ]);

    if (qaCode === 0) {
      // npm install produced the lockfile after the initial commit; it
      // belongs in the client repo for reproducible installs.
      try {
        const { execFileSync } = await import('node:child_process');
        execFileSync('git', ['add', 'package-lock.json'], { cwd: outDir });
        execFileSync(
          'git',
          ['-c', 'user.name=Deneb4 Builder', '-c', 'user.email=agents@deneb4.com', 'commit', '--quiet', '-m', 'Add npm lockfile from first install'],
          { cwd: outDir }
        );
      } catch {
        /* nothing to commit is fine */
      }
      const moduleList = Object.entries(shas).map(([n, s]) => `${n}@${s.slice(0, 7)}`).join(', ');
      const summary =
        `Assembled ${slug} from the d4 templates (commit ${commitSha}). ` +
        `Modules: ${qa.record.siteName ? '' : ''}${Object.keys(qa.record.modules).join(', ')}. ` +
        `Routes: ${qa.manifest.public.join(', ')} (+/admin). ` +
        (qa.skipped.length ? `QA skipped (need content/session): ${qa.skipped.join(', ')}. ` : '') +
        pushResult.detail;
      await ledger('event', summary, {
        commit: commitSha,
        templates: moduleList,
        routes: qa.manifest.public.join(','),
        pushed: String(pushResult.pushed),
        ...(pushResult.url ? { repoUrl: pushResult.url } : {}),
        buildPath: path.relative(REPO_ROOT, outDir),
      });
      const moved = await advanceToGate();
      console.log(`\nHanded off to internal-review (Ridhi's gate). Pipeline: ${moved.stage || 'internal-review'}.`);
      return 0;
    }

    await ledger('event', 'QA verification failed; build not advanced. See the QA alert for specifics.', {
      qaExit: String(qaCode),
      buildPath: path.relative(REPO_ROOT, outDir),
    });
    console.error('\nQA failed. Pipeline left at "building"; QA alert sent to Ridhi.');
    return 1;
  } catch (err) {
    const msg = `Builder crashed during install/build/QA: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    await ledger('alert', msg, { phase: 'build-qa' });
    return 1;
  } finally {
    if (server) server.kill();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
    setTimeout(() => process.exit(code), 4000).unref();
  })
  .catch((err) => {
    console.error('Fatal:', err);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 4000).unref();
  });

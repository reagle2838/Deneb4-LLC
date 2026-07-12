#!/usr/bin/env node
/**
 * The Builder agent: git-native, driving Ridhi's real d4-site-builder
 * ecosystem (github.com/deneb4admin). Two modes, auto-detected:
 *
 * FIRST BUILD (no builds/<slug> yet): mirror the d4 repos -> assemble via
 * d4-site-builder -> git init as the client's own repo -> install/build/
 * serve -> QA -> green: ledger summary + advance pipeline to internal-review
 * (Ridhi's gate) and STOP; failure: escalate.
 *
 * CHANGE MODE (builds/<slug> is an existing git repo): the client's build
 * config has been edited; apply ONLY the delta. Pull if a remote exists,
 * refuse a dirty tree, assemble the new config to a temp dir with Ridhi's
 * assembler and sync config-owned artifacts + module payload adds/removes
 * (manual edits elsewhere survive), commit, QA, and on green push + report;
 * on QA failure REVERT the change commit so the repo returns to its last
 * good state, and escalate. Changes never advance the pipeline.
 *
 * All agent interactions go over HTTP with x-agent-key, because escalation
 * emails and auto-logged handoffs only fire through the API routes.
 *
 * Usage:
 *   node scripts/build-client.mjs <slug> --report-to http://localhost:3005 [--port 4181]
 *   node scripts/build-client.mjs <slug> --assemble-only   # first build only, no QA/HTTP
 *
 * Exit 0 = success; non-zero = refused/failed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT,
  BUILDS_DIR,
  ensureMirror,
  loadBuildConfig,
  assemble,
  applyChange,
  writeAppliedConfig,
  deriveQaManifest,
  writeEnvLocal,
  gitInitCommit,
  gitCommitAll,
  gitRevertHead,
  gitIsDirty,
  gitPullIfRemote,
  maybePushToGitHub,
} from './builder/d4.mjs';

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
const slug = args.find((a) => !a.startsWith('--'));
const optOf = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const reportTo = (optOf('report-to') || '').replace(/\/$/, '');
const port = Number(optOf('port')) || 4181;
const assembleOnly = args.includes('--assemble-only');
const injectFault = args.includes('--inject-fault'); // test affordance: forces QA red
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

/**
 * Opt-in (AUTO_DEPLOY_STAGING=true): after a green build, push the site to
 * a staging URL and record it on the client's record. Spawned detached so
 * it never blocks the Builder — the deploy script reports to the ledger
 * itself. A brand-new build isn't deployed until it clears Ridhi's internal
 * review, so this only fires from change mode; first builds print the hint.
 */
function maybeDeployStaging() {
  if (process.env.AUTO_DEPLOY_STAGING !== 'true') return false;
  const deployArgs = [path.join(HERE, 'deploy-staging.mjs'), slug];
  if (reportTo) deployArgs.push('--report-to', reportTo);
  const child = spawn(process.execPath, deployArgs, {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, NODE_OPTIONS: '--use-system-ca' },
  });
  child.unref();
  return true;
}

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

/** Shared: install (optionally), build, serve, QA. Returns { qaCode, server }. */
async function buildAndQa(outDir, qaManifestFile, { install }) {
  // When the Builder is spawned FROM the running Next dev server (the
  // BUILDER_AUTORUN path on proposal approval), the child inherits Next's
  // own env (NODE_ENV=development, __NEXT_PRIVATE_*, PORT), which breaks a
  // nested `next build`. Strip those so the client build runs clean.
  const buildEnv = { ...process.env, NODE_OPTIONS: '--use-system-ca' };
  for (const key of Object.keys(buildEnv)) {
    if (/^(__NEXT|NEXT_|TURBOPACK)/i.test(key)) delete buildEnv[key];
  }
  delete buildEnv.NODE_ENV;
  delete buildEnv.PORT;

  if (install) {
    console.log('\nnpm install...');
    const installCode = await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: outDir, env: buildEnv, shell: true });
    if (installCode !== 0) throw new Error(`npm install failed (exit ${installCode}).`);
  }

  console.log('\nnext build...');
  const nextBin = path.join(outDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  const buildCode = await run('node', [nextBin, 'build'], { cwd: outDir, env: buildEnv });
  if (buildCode !== 0) throw new Error(`next build failed (exit ${buildCode}).`);

  console.log(`\nStarting the site on :${port} for QA...`);
  const server = spawn('node', [nextBin, 'start', '-p', String(port)], { cwd: outDir, env: buildEnv, stdio: 'ignore' });
  const up = await waitForServer(`http://127.0.0.1:${port}/`);
  if (!up) {
    server.kill();
    throw new Error('Assembled site did not start within 60s.');
  }

  // Browser QA artifacts (screenshots, baselines, diffs) live OUTSIDE the
  // client repo so they never pollute its git history.
  const qaCode = await run('node', [
    path.join(HERE, 'verify.mjs'),
    `http://127.0.0.1:${port}`,
    '--manifest', qaManifestFile,
    '--qa-dir', path.join(BUILDS_DIR, '.qa', slug),
    '--client', slug,
    '--key', agentKey,
    '--report-to', reportTo,
  ]);
  return { qaCode, server };
}

// ── First build ──────────────────────────────────────────────────────────
async function firstBuild() {
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
    writeAppliedConfig(outDir, cfg);
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

  let server;
  try {
    const result = await buildAndQa(outDir, qa.file, { install: true });
    server = result.server;

    if (result.qaCode === 0) {
      try {
        gitCommitAll(outDir, 'Add npm lockfile from first install');
      } catch {
        /* nothing to commit is fine */
      }
      const moduleList = Object.entries(shas).map(([n, s]) => `${n}@${s.slice(0, 7)}`).join(', ');
      const summary =
        `Assembled ${slug} from the d4 templates (commit ${commitSha}). ` +
        `Modules: ${Object.keys(qa.record.modules).join(', ')}. ` +
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
      if (maybeDeployStaging()) console.log('Auto-deploying to staging in the background so you can review it.');
      console.log(`\nHanded off to internal-review (Ridhi's gate). Pipeline: ${moved.stage || 'internal-review'}.`);
      return 0;
    }

    await ledger('event', 'QA verification failed; build not advanced. See the QA alert for specifics.', {
      qaExit: String(result.qaCode),
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

// ── Change mode ──────────────────────────────────────────────────────────
async function changeBuild(outDir) {
  if (assembleOnly) {
    console.error('Change mode always runs QA; --assemble-only is only for first builds.');
    return 2;
  }

  // Work like a person would: pull first, never build on uncommitted state.
  let committed = false;
  let commitSha = '';
  try {
    if (gitIsDirty(outDir)) {
      console.error(
        `Refusing: builds/${slug} has uncommitted changes. Commit them (they are yours and will be respected) and re-run.`
      );
      return 1;
    }
    const pull = gitPullIfRemote(outDir);
    console.log(pull.detail);

    console.log('Mirroring d4 template repos...');
    ensureMirror();
    const cfg = loadBuildConfig(slug);

    console.log('Computing config delta...');
    const change = await applyChange(slug, cfg);
    if (change.noop) {
      console.log(change.summary);
      return 0;
    }
    console.log(change.summary);

    commitSha = gitCommitAll(outDir, `Change: ${change.summary}`);
    committed = true;
    console.log(`Committed change ${commitSha}.`);

    const qa = deriveQaManifest(outDir);
    if (injectFault) {
      // Test affordance: demand a route that does not exist so QA goes red.
      const m = JSON.parse(fs.readFileSync(qa.file, 'utf-8'));
      m.public.push('/bogus-fault-injected-route');
      fs.writeFileSync(qa.file, JSON.stringify(m, null, 2));
      console.log('(fault injected into QA manifest)');
    }

    const result = await buildAndQa(outDir, qa.file, { install: change.pkgChanged });
    const server = result.server;
    try {
      if (result.qaCode === 0) {
        try {
          gitCommitAll(outDir, 'Update lockfile after dependency change');
        } catch {
          /* nothing to commit is fine */
        }
        const pushResult = await maybePushToGitHub(slug, outDir);
        console.log(pushResult.detail);
        await ledger('event', `${change.summary} QA green; committed as ${commitSha}. ${pushResult.detail}`, {
          commit: commitSha,
          changedFiles: String(change.changed.length),
          modulesAdded: change.added.join(',') || '',
          modulesRemoved: change.removed.join(',') || '',
          pushed: String(pushResult.pushed),
          buildPath: path.relative(REPO_ROOT, outDir),
        });
        if (maybeDeployStaging()) console.log('Auto-deploying the change to staging in the background.');
        console.log('\nChange applied and verified. Pipeline stage unchanged (changes never advance stages).');
        return 0;
      }

      // QA red: put the repo back to its last good state, then report.
      const revertSha = gitRevertHead(outDir);
      await ledger(
        'event',
        `Change was applied (${commitSha}) but QA failed, so it was reverted (${revertSha}). The site is back at its last good state. See the QA alert for specifics.`,
        { commit: commitSha, revertedBy: revertSha, buildPath: path.relative(REPO_ROOT, outDir) }
      );
      console.error('\nQA failed; change reverted. QA alert sent to Ridhi.');
      return 1;
    } finally {
      server.kill();
    }
  } catch (err) {
    const msg = `Builder crashed during change: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    if (committed) {
      try {
        const revertSha = gitRevertHead(outDir);
        console.error(`Change commit ${commitSha} reverted (${revertSha}).`);
      } catch {
        console.error('Automatic revert also failed; the repo may need a manual look.');
      }
    }
    await ledger('alert', msg, { phase: 'change' });
    return 1;
  }
}

async function main() {
  const outDir = path.join(BUILDS_DIR, slug);
  const dirExists = fs.existsSync(outDir);
  const isRepo = dirExists && fs.existsSync(path.join(outDir, '.git'));
  if (dirExists && !isRepo) {
    console.error(`builds/${slug} exists but is not a git repo. Unexpected state; refusing to touch it.`);
    return 2;
  }
  const changeMode = isRepo;

  if (!assembleOnly) {
    if (!reportTo) {
      console.error('Missing --report-to <origin>. Use --assemble-only (first builds) to skip agent wiring.');
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
    const allowed = changeMode ? ['building', 'client-review'] : ['building'];
    if (!allowed.includes(stageInfo.stage)) {
      console.error(
        `Refusing: "${slug}" is at "${stageInfo.stage}". ${changeMode ? 'Changes run at building or client-review.' : 'First builds run at building.'}`
      );
      return 1;
    }
  }

  if (changeMode) {
    console.log(`Existing client repo detected at builds/${slug}: change mode.`);
    return changeBuild(outDir);
  }
  return firstBuild();
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

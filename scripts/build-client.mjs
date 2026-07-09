#!/usr/bin/env node
/**
 * The Builder agent runner (ROADMAP: "Build orchestration loop: config,
 * assemble, verify, pass or escalate").
 *
 * Flow: read the client's pipeline stage (read-before-acting) -> assemble
 * deterministically -> serve the build locally -> run the QA harness against
 * it -> on green, write a change summary to the client's ledger and advance
 * the pipeline to `internal-review` (Ridhi's gate) and STOP -> on any
 * failure, escalate (alert -> Ridhi's inbox) and stop.
 *
 * All agent interactions go over HTTP with x-agent-key (same as verify.mjs),
 * because the escalation email and the auto-logged handoff entry only fire
 * through the API routes, not the bare lib functions.
 *
 * Usage:
 *   node scripts/build-client.mjs <slug> --report-to http://localhost:3005 [--port 4180]
 *   node scripts/build-client.mjs <slug> --assemble-only        # no server/QA/HTTP
 *
 * Exit 0 = assembled + QA green + advanced to gate; non-zero = refused/failed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runBuild } from './builder/index.mjs';
import { startStaticServer } from './builder/serve.mjs';
import { BuildValidationError } from './builder/config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

// Load .env.local into process.env (AGENT_API_KEY for HTTP, ANTHROPIC_API_KEY
// for the optional copy layer) so the runner works without manual exports.
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
const port = Number(optOf('port')) || 4180;
const assembleOnly = args.includes('--assemble-only');
const agentKey = process.env.AGENT_API_KEY || '';

if (!slug) {
  console.error('Usage: node scripts/build-client.mjs <slug> --report-to <origin> [--port 4180] [--assemble-only]');
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
  return res.json(); // { ok, client, stage, label, gated, stages }
}

async function advanceToGate() {
  const res = await fetch(`${reportTo}/api/agents/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
    body: JSON.stringify({
      client: slug,
      stage: 'internal-review',
      agent: 'builder',
      note: 'Assembled + QA green; ready for design + copy review.',
    }),
  });
  return res.json();
}

async function main() {
  // Assemble-only shortcut: no HTTP, no server, no QA.
  if (assembleOnly) {
    const result = await runBuild(slug);
    console.log(result.summary);
    console.log('Output:', result.outDir);
    return 0;
  }

  if (!reportTo) {
    console.error('Missing --report-to <origin> (needed for ledger/pipeline). Use --assemble-only to skip.');
    return 2;
  }
  if (!agentKey) {
    console.error('AGENT_API_KEY not found (checked env + .env.local).');
    return 2;
  }

  // 1. Read before acting: confirm the client exists and is safe to build.
  let stageInfo;
  try {
    stageInfo = await readStage();
  } catch (err) {
    console.error('Could not read pipeline:', err instanceof Error ? err.message : err);
    return 2;
  }
  if (stageInfo.notFound) {
    console.error(`Client "${slug}" not found. Create it (and set stage to "building") first.`);
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

  // 2. Assemble (validation failure or exception -> escalate).
  let result;
  try {
    result = await runBuild(slug);
    // Test affordance: corrupt the assembled build so QA fails, to exercise
    // the QA-red escalation path end to end. Never used in real runs.
    if (args.includes('--inject-fault')) {
      const victim = result.routes.public.find((r) => r !== '/');
      if (victim) fs.rmSync(path.join(result.outDir, `${victim.replace(/^\//, '')}.html`));
    }
  } catch (err) {
    const msg = err instanceof BuildValidationError
      ? `Build config invalid, cannot assemble:\n- ${err.errors.join('\n- ')}`
      : `Builder crashed while assembling: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    await ledger('alert', msg, { phase: 'assemble' });
    return 1;
  }
  console.log(result.summary);

  // 3. Serve + 4. QA harness against the assembled build.
  let server;
  try {
    server = await startStaticServer(result.outDir, port);
    // Async spawn (NOT spawnSync): the static server runs in THIS process, so
    // the event loop must stay free to answer QA's requests.
    const qaCode = await new Promise((resolve) => {
      const child = spawn(
        'node',
        [
          path.join(HERE, 'verify.mjs'),
          server.url,
          '--manifest', path.join(result.outDir, 'routes.json'),
          '--client', slug,
          '--key', agentKey,
          '--report-to', reportTo,
        ],
        { stdio: 'inherit' }
      );
      child.on('close', (code) => resolve(code ?? 1));
      child.on('error', () => resolve(1));
    });

    if (qaCode === 0) {
      // GREEN: change summary to the ledger, advance to Ridhi's gate, STOP.
      await ledger('event', result.summary, {
        modules: result.enabledModules.join(','),
        preset: result.preset,
        accent: result.accent || '',
        buildPath: path.relative(REPO_ROOT, result.outDir),
        routes: result.routes.public.join(','),
      });
      const moved = await advanceToGate();
      console.log(`\nHanded off to internal-review (Ridhi's gate). Pipeline: ${moved.stage || 'internal-review'}.`);
      return 0;
    }

    // RED: QA already posted its own alert via --report-to (that's the
    // escalation email). The Builder logs that it stopped; it does NOT advance.
    await ledger('event', 'QA verification failed; build not advanced. See the QA alert above for specifics.', {
      qaExit: String(qaCode),
      buildPath: path.relative(REPO_ROOT, result.outDir),
    });
    console.error('\nQA failed. Pipeline left at "building"; QA alert sent to Ridhi.');
    return 1;
  } catch (err) {
    const msg = `Builder crashed during serve/QA: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    await ledger('alert', msg, { phase: 'qa' });
    return 1;
  } finally {
    if (server) await server.close();
  }
}

main()
  .then((code) => {
    // Set the exit code and let the loop drain naturally (avoids a Windows
    // libuv assertion from process.exit force-closing keep-alive sockets).
    // A short unref'd timer force-exits only if something keeps us alive.
    process.exitCode = code;
    setTimeout(() => process.exit(code), 4000).unref();
  })
  .catch((err) => {
    console.error('Fatal:', err);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 4000).unref();
  });

#!/usr/bin/env node
/**
 * Heartbeat trigger: the tiny, dependency-free command a scheduler runs to
 * fire the agent heartbeat (ROADMAP: "point a scheduler at POST
 * /api/agents/tick"). Reads AGENT_API_KEY from .env.local, POSTs to the
 * tick endpoint, prints a one-line result. Resilient: if the app is down
 * (e.g. the dev server isn't running), it says so and exits 0 so the
 * scheduler doesn't flag a failure for an expected-offline window.
 *
 * Usage:
 *   node scripts/heartbeat-trigger.mjs [--url http://localhost:3005]
 *
 * The scheduler registration script (register-heartbeat-task.ps1) calls
 * this; you can also run it by hand to fire a tick from the terminal.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const args = process.argv.slice(2);
const optOf = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const url = (optOf('url') || process.env.HEARTBEAT_URL || 'http://localhost:3005').replace(/\/$/, '');

function agentKey() {
  const file = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(file)) return '';
  return (fs.readFileSync(file, 'utf-8').match(/^AGENT_API_KEY=(.+)$/m) || [])[1]?.trim() || '';
}

const stamp = () => new Date().toISOString();

async function main() {
  const key = agentKey();
  if (!key) {
    console.error(`${stamp()} heartbeat: AGENT_API_KEY not found in .env.local; cannot authenticate.`);
    process.exitCode = 1;
    return;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000); // duties can be slow (builds, probes)
  try {
    const res = await fetch(`${url}/api/agents/tick?trigger=scheduler`, {
      method: 'POST',
      headers: { 'x-agent-key': key },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error(`${stamp()} heartbeat: tick returned HTTP ${res.status}.`);
      process.exitCode = 1;
      return;
    }
    const data = await res.json();
    const duties = data.run?.duties ?? [];
    const summary = duties.map((d) => `${d.name}=${d.status}`).join(' ');
    console.log(`${stamp()} heartbeat ok (${duties.length} duties): ${summary}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Connection refused = the app isn't up. Expected during offline windows;
    // don't fail the scheduled task over it.
    if (/ECONNREFUSED|fetch failed|aborted/i.test(msg)) {
      console.log(`${stamp()} heartbeat skipped: app not reachable at ${url} (${msg}).`);
      return;
    }
    console.error(`${stamp()} heartbeat error: ${msg}`);
    process.exitCode = 1;
  } finally {
    clearTimeout(t);
  }
}

main();

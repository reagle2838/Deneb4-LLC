#!/usr/bin/env node
/**
 * Deneb4 site verification harness (ROADMAP Phase 3, the keystone).
 *
 * Runs a battery of checks against a running site and reports structured
 * pass/fail. This is the QA agent's tool and a regression guard for the
 * Deneb4 site itself. When the template + compiler land, the same runner
 * points at a client's staging URL and gains per-module checks.
 *
 * Dependency-free (global fetch + regex HTML parsing). Browser-dependent
 * checks (visual regression, real contrast/a11y) are a documented
 * follow-up that needs Playwright.
 *
 * Usage:
 *   node scripts/verify.mjs <baseUrl>
 *   node scripts/verify.mjs http://localhost:3005
 *   node scripts/verify.mjs https://staging.client.com \
 *     --client acme --key <AGENT_API_KEY> --report-to https://deneb4.com
 *   # template-aware (Builder): drive the checks from an assembled routes.json
 *   node scripts/verify.mjs http://localhost:4180 --manifest builds/acme/routes.json
 *
 * Exit code 0 = all checks passed, 1 = one or more failed.
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) || '').replace(/\/$/, '');
function opt(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const clientSlug = opt('client');
const agentKey = opt('key');
const reportTo = (opt('report-to') || '').replace(/\/$/, '');
const REQUEST_TIMEOUT = Number(opt('timeout')) || 30000;
const MAX_LINKS = 150;

if (!base) {
  console.error('Usage: node scripts/verify.mjs <baseUrl> [--client slug --key KEY --report-to url]');
  process.exit(2);
}

// Route lists. Default = Deneb4's own site map (keystone regression guard).
// With --manifest <path>, they are sourced from an assembled routes.json so
// the harness can QA an arbitrary template/client build (the Builder's QA).
let PUBLIC_ROUTES = [
  '/', '/services', '/process', '/work', '/articles', '/about',
  '/contact', '/start', '/industries', '/faq', '/privacy', '/terms',
];
let GATED_ROUTES = [
  { path: '/portal', expect: [307, 302] },
  { path: '/portal-feedback', expect: [307, 302] },
  { path: '/cms-login', expect: [200] },
];
let ASSETS = ['/logo.png', '/widget.js'];

const manifestPath = opt('manifest');
if (manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    console.error(`Could not read --manifest ${manifestPath}: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }
  // gated entries may be plain strings (default expect [200]) or { path, expect }.
  PUBLIC_ROUTES = Array.isArray(manifest.public) ? manifest.public : ['/'];
  GATED_ROUTES = Array.isArray(manifest.gated)
    ? manifest.gated.map((g) => (typeof g === 'string' ? { path: g, expect: [200] } : g))
    : [];
  ASSETS = Array.isArray(manifest.assets) ? manifest.assets : [];
}

async function fetchStatus(url, { redirect = 'manual' } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { redirect, signal: ctrl.signal });
    return { status: res.status, res };
  } catch (err) {
    return { status: 0, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal });
    return { status: res.status, text: res.status < 400 ? await res.text() : '' };
  } catch (err) {
    return { status: 0, text: '', error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(t);
  }
}

// ── Check 1: critical routes render ─────────────────────────────────────
async function checkRoutes() {
  const details = [];
  let failed = 0;
  for (const path of PUBLIC_ROUTES) {
    const { status } = await fetchStatus(base + path, { redirect: 'follow' });
    const ok = status === 200;
    if (!ok) failed++;
    details.push(`${ok ? 'ok ' : 'FAIL'} ${path} -> ${status}`);
  }
  for (const g of GATED_ROUTES) {
    const { status } = await fetchStatus(base + g.path);
    const ok = g.expect.includes(status);
    if (!ok) failed++;
    details.push(`${ok ? 'ok ' : 'FAIL'} ${g.path} -> ${status} (expected ${g.expect.join('/')})`);
  }
  return { name: 'routes render', status: failed ? 'fail' : 'pass', details };
}

// ── Check 2: page structure (title + single h1) ─────────────────────────
async function checkStructure() {
  const details = [];
  let failed = 0;
  for (const path of PUBLIC_ROUTES) {
    const { text, status } = await fetchText(base + path);
    if (status !== 200) {
      failed++;
      details.push(`FAIL ${path} -> ${status}`);
      continue;
    }
    const title = (text.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || '';
    const h1Count = (text.match(/<h1[\s>]/gi) || []).length;
    const problems = [];
    if (!title) problems.push('no <title>');
    if (h1Count === 0) problems.push('no <h1>');
    if (problems.length) {
      failed++;
      details.push(`FAIL ${path}: ${problems.join(', ')}`);
    } else {
      details.push(`ok  ${path}: "${title.slice(0, 40)}" (${h1Count} h1)`);
    }
  }
  return { name: 'page structure', status: failed ? 'fail' : 'pass', details };
}

// ── Check 3: internal link integrity (crawl public pages) ───────────────
function extractInternalLinks(html) {
  const links = new Set();
  const re = /href="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    let href = m[1];
    if (!href) continue;
    if (href.startsWith('//')) continue; // protocol-relative external
    if (/^(mailto:|tel:|https?:|#|data:)/i.test(href)) continue;
    if (!href.startsWith('/')) continue; // only same-origin absolute paths
    href = href.split('#')[0].split('?')[0];
    if (href && href !== '') links.add(href);
  }
  return links;
}

async function checkLinks() {
  const details = [];
  const all = new Set();
  for (const path of PUBLIC_ROUTES) {
    const { text } = await fetchText(base + path);
    for (const l of extractInternalLinks(text)) all.add(l);
  }
  const unique = [...all].slice(0, MAX_LINKS);
  let failed = 0;
  for (const path of unique) {
    const { status } = await fetchStatus(base + path, { redirect: 'follow' });
    if (status !== 200) {
      failed++;
      details.push(`FAIL ${path} -> ${status}`);
    }
  }
  details.unshift(`${unique.length} unique internal links checked, ${failed} broken`);
  return { name: 'internal links', status: failed ? 'fail' : 'pass', details };
}

// ── Check 4: key assets resolve ─────────────────────────────────────────
async function checkAssets() {
  const details = [];
  let failed = 0;
  for (const path of ASSETS) {
    const { status } = await fetchStatus(base + path, { redirect: 'follow' });
    const ok = status === 200;
    if (!ok) failed++;
    details.push(`${ok ? 'ok ' : 'FAIL'} ${path} -> ${status}`);
  }
  return { name: 'assets', status: failed ? 'fail' : 'pass', details };
}

async function reportToLedger(passed, summary) {
  if (!clientSlug || !agentKey || !reportTo) return;
  try {
    await fetch(`${reportTo}/api/agents/ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
      body: JSON.stringify({
        channel: clientSlug,
        agent: 'qa',
        kind: passed ? 'event' : 'alert',
        message: `Verification ${passed ? 'passed' : 'FAILED'} for ${base}.\n${summary}`,
        data: { target: base, passed: String(passed) },
      }),
    });
    console.log(`\nReported verdict to ${clientSlug}'s ledger channel.`);
  } catch (err) {
    console.error('Could not report to ledger:', err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log(`\nVerifying ${base}\n${'='.repeat(50)}`);
  const checks = [await checkRoutes(), await checkStructure(), await checkLinks(), await checkAssets()];

  for (const c of checks) {
    console.log(`\n[${c.status === 'pass' ? 'PASS' : 'FAIL'}] ${c.name}`);
    for (const d of c.details) console.log(`   ${d}`);
  }

  const failedChecks = checks.filter((c) => c.status === 'fail');
  const passed = failedChecks.length === 0;
  const summary = passed
    ? `All ${checks.length} checks passed.`
    : `${failedChecks.length}/${checks.length} checks failed: ${failedChecks.map((c) => c.name).join(', ')}.`;

  console.log(`\n${'='.repeat(50)}\n${passed ? 'PASS' : 'FAIL'}: ${summary}\n`);

  await reportToLedger(passed, summary);
  process.exit(passed ? 0 : 1);
}

main();

#!/usr/bin/env node
/**
 * Deneb4 site verification harness (ROADMAP Phase 3, the keystone).
 *
 * Runs a battery of checks against a running site and reports structured
 * pass/fail. This is the QA agent's tool and a regression guard for the
 * Deneb4 site itself. When the template + compiler land, the same runner
 * points at a client's staging URL and gains per-module checks.
 *
 * Core checks are dependency-free (global fetch + regex HTML parsing).
 * Browser checks (real rendering) need Playwright, installed in THIS repo's
 * node_modules (client builds never need it): console/page errors, axe-core
 * accessibility (incl. real color contrast; serious/critical violations fail),
 * mobile-viewport overflow, and screenshots with a last-known-good baseline
 * comparison. Visual diffs are informational, not a gate: intentional config
 * changes change pixels, so the diff list is evidence for Ridhi's review, and
 * the baseline refreshes only when a run passes.
 *
 * Usage:
 *   node scripts/verify.mjs <baseUrl>
 *   node scripts/verify.mjs http://localhost:3005
 *   node scripts/verify.mjs https://staging.client.com \
 *     --client acme --key <AGENT_API_KEY> --report-to https://deneb4.com
 *   # template-aware (Builder): drive the checks from an assembled routes.json
 *   node scripts/verify.mjs http://localhost:4180 --manifest builds/acme/routes.json
 *   # browser checks: on automatically when --qa-dir is given (Builder path),
 *   # or force with --browser on (no screenshots without --qa-dir)
 *   node scripts/verify.mjs http://localhost:4181 --manifest ... --qa-dir builds/.qa/acme
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

// Browser checks: on when a QA artifacts dir is provided (the Builder path),
// or forced with --browser on; --browser off disables even with --qa-dir.
const qaDir = opt('qa-dir');
const browserFlag = opt('browser');
const browserEnabled = browserFlag !== 'off' && (browserFlag === 'on' || Boolean(qaDir));

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

// ── Browser checks (Playwright): errors, a11y, mobile overflow, snapshots ─
const routeSlug = (p) => (p === '/' ? 'home' : p.replace(/^\//, '').replace(/\//g, '__'));

/**
 * Single desktop pass per route (console/page errors + axe + screenshot),
 * plus a mobile pass for horizontal-overflow detection. Returns the check
 * objects and the list of visually-changed routes (informational).
 */
async function runBrowserChecks() {
  const { chromium } = await import('playwright');
  const { default: AxeBuilder } = await import('@axe-core/playwright');

  const errorCheck = { name: 'browser errors', status: 'pass', details: [] };
  const axeCheck = { name: 'accessibility (axe)', status: 'pass', details: [] };
  const mobileCheck = { name: 'mobile overflow (375px)', status: 'pass', details: [] };
  const visualCheck = { name: 'visual snapshots (informational)', status: 'pass', details: [] };
  const visualChanges = [];

  const currentDir = qaDir ? `${qaDir}/current` : null;
  const baselineDir = qaDir ? `${qaDir}/baseline` : null;
  const diffDir = qaDir ? `${qaDir}/diff` : null;
  if (qaDir) for (const d of [currentDir, baselineDir, diffDir]) fs.mkdirSync(d, { recursive: true });

  const browser = await chromium.launch();
  try {
    // Desktop pass
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    for (const route of PUBLIC_ROUTES) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text().slice(0, 160)}`); });
      page.on('pageerror', (err) => errors.push(`pageerror: ${String(err).slice(0, 160)}`));
      page.on('response', (res) => {
        if (res.status() >= 400 && res.url().startsWith(base)) errors.push(`http ${res.status()}: ${res.url().slice(base.length)}`);
      });
      try {
        await page.goto(base + route, { waitUntil: 'load', timeout: REQUEST_TIMEOUT });
        await page.waitForTimeout(300);
      } catch (err) {
        errorCheck.status = 'fail';
        errorCheck.details.push(`FAIL ${route}: navigation failed (${err instanceof Error ? err.message.split('\n')[0] : err})`);
        await page.close();
        continue;
      }

      if (errors.length) {
        errorCheck.status = 'fail';
        errorCheck.details.push(`FAIL ${route}: ${errors.slice(0, 4).join(' | ')}${errors.length > 4 ? ` (+${errors.length - 4} more)` : ''}`);
      } else {
        errorCheck.details.push(`ok  ${route}`);
      }

      // axe: serious/critical fail the gate (color contrast is 'serious'); the rest is reported
      const axe = await new AxeBuilder({ page }).analyze();
      const gating = axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      const minor = axe.violations.filter((v) => v.impact !== 'critical' && v.impact !== 'serious');
      if (gating.length) {
        axeCheck.status = 'fail';
        axeCheck.details.push(`FAIL ${route}: ${gating.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`).join(', ')}`);
      } else {
        axeCheck.details.push(`ok  ${route}${minor.length ? ` (minor: ${minor.map((v) => v.id).join(', ')})` : ''}`);
      }

      // Screenshot for the visual record (animations already reduced; settle fonts)
      if (qaDir) {
        await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${currentDir}/${routeSlug(route)}.png`, fullPage: true });
      }
      await page.close();
    }
    await ctx.close();

    // Mobile pass: no horizontal scroll at phone width
    const mctx = await browser.newContext({ viewport: { width: 375, height: 667 }, reducedMotion: 'reduce' });
    for (const route of PUBLIC_ROUTES) {
      const page = await mctx.newPage();
      try {
        await page.goto(base + route, { waitUntil: 'load', timeout: REQUEST_TIMEOUT });
        const { scrollW, clientW } = await page.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        if (scrollW > clientW + 1) {
          mobileCheck.status = 'fail';
          mobileCheck.details.push(`FAIL ${route}: content ${scrollW}px wide in a ${clientW}px viewport`);
        } else {
          mobileCheck.details.push(`ok  ${route}`);
        }
      } catch (err) {
        mobileCheck.status = 'fail';
        mobileCheck.details.push(`FAIL ${route}: navigation failed (${err instanceof Error ? err.message.split('\n')[0] : err})`);
      }
      await page.close();
    }
    await mctx.close();
  } finally {
    await browser.close();
  }

  // Compare against the last-known-good baseline (informational; the baseline
  // is refreshed by main() only when the whole run passes)
  if (qaDir) {
    const { default: pixelmatch } = await import('pixelmatch');
    const { PNG } = await import('pngjs');
    for (const route of PUBLIC_ROUTES) {
      const name = `${routeSlug(route)}.png`;
      const basePath = `${baselineDir}/${name}`;
      if (!fs.existsSync(basePath)) {
        visualCheck.details.push(`seeded ${route} (no baseline yet)`);
        continue;
      }
      const a = PNG.sync.read(fs.readFileSync(basePath));
      const b = PNG.sync.read(fs.readFileSync(`${currentDir}/${name}`));
      if (a.width !== b.width || a.height !== b.height) {
        visualChanges.push(route);
        visualCheck.details.push(`CHANGED ${route}: page size ${a.width}x${a.height} -> ${b.width}x${b.height}`);
        continue;
      }
      const diff = new PNG({ width: a.width, height: a.height });
      const changedPx = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
      const ratio = changedPx / (a.width * a.height);
      if (ratio > 0.001) {
        visualChanges.push(route);
        fs.writeFileSync(`${diffDir}/${name}`, PNG.sync.write(diff));
        visualCheck.details.push(`CHANGED ${route}: ${(ratio * 100).toFixed(2)}% of pixels differ (see ${diffDir}/${name})`);
      } else {
        visualCheck.details.push(`ok  ${route} (no visual change)`);
      }
    }
  } else {
    visualCheck.details.push('skipped (no --qa-dir; screenshots need a place to live)');
  }

  const checks = [errorCheck, axeCheck, mobileCheck, visualCheck];
  return { checks, visualChanges, currentDir, baselineDir };
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

  let browser = null;
  if (browserEnabled) {
    try {
      browser = await runBrowserChecks();
      checks.push(...browser.checks);
    } catch (err) {
      // Browser checks were requested; a broken harness must not pass silently.
      checks.push({
        name: 'browser harness',
        status: 'fail',
        details: [`Playwright checks could not run: ${err instanceof Error ? err.message.split('\n')[0] : err}`],
      });
    }
  } else {
    console.log('\n(browser checks off; enable with --qa-dir <dir> or --browser on)');
  }

  for (const c of checks) {
    console.log(`\n[${c.status === 'pass' ? 'PASS' : 'FAIL'}] ${c.name}`);
    for (const d of c.details) console.log(`   ${d}`);
  }

  const failedChecks = checks.filter((c) => c.status === 'fail');
  const passed = failedChecks.length === 0;
  let summary = passed
    ? `All ${checks.length} checks passed.`
    : `${failedChecks.length}/${checks.length} checks failed: ${failedChecks.map((c) => c.name).join(', ')}.`;
  if (browser?.visualChanges.length) {
    summary += ` Visual changes vs last good build: ${browser.visualChanges.join(', ')}.`;
  }

  // The baseline is always the last state that passed the full battery.
  if (passed && browser?.currentDir && fs.existsSync(browser.currentDir)) {
    fs.cpSync(browser.currentDir, browser.baselineDir, { recursive: true, force: true });
    console.log('Visual baseline updated to this passing run.');
  }

  console.log(`\n${'='.repeat(50)}\n${passed ? 'PASS' : 'FAIL'}: ${summary}\n`);

  await reportToLedger(passed, summary);
  process.exit(passed ? 0 : 1);
}

main();

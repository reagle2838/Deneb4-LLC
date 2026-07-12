#!/usr/bin/env node
/**
 * Brand ingestion (ROADMAP Phase 2): pull a client's existing brand palette
 * off their current website and turn it into a PROPOSED custom theme for
 * their new build — never an applied one. The proposal lands in the same
 * Change Proposals queue as everything else: Ridhi sees the actual swatches
 * in the Workspace and approves or rejects. Deterministic, no LLM.
 *
 * Usage:
 *   npm run brand -- <slug> --url https://their-old-site.com \
 *     [--report-to http://localhost:3005]
 *
 * How the palette is derived:
 *   - Fetch the page + its same-origin stylesheets (capped).
 *   - Collect every #hex / rgb() literal, weighted by how often it appears.
 *   - Chromatic colors compete for accent; light neutrals for backgrounds;
 *     dark neutrals for text. Missing roles fall back to sane derivations
 *     (accent-strong = darkened accent, etc.) so the palette is always
 *     complete — the validator refuses partial themes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
function opt(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const url = opt('url');
const reportTo = (opt('report-to') || 'http://localhost:3005').replace(/\/$/, '');

if (!slug || !url) {
  console.error('Usage: npm run brand -- <slug> --url <https://their-current-site> [--report-to <origin>]');
  process.exit(2);
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Color math ────────────────────────────────────────────────────────────
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const luminance = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const saturation = ([r, g, b]) => {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max === 0 ? 0 : (max - min) / max;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const scale = (rgb, k) => rgb.map((c) => clamp(c * k));
const channels = (rgb) => rgb.map(clamp).join(' ');

function parseColorLiterals(text) {
  const found = new Map(); // "r,g,b" -> weight
  const bump = (rgb, w = 1) => {
    const key = rgb.map(clamp).join(',');
    found.set(key, (found.get(key) ?? 0) + w);
  };
  for (const m of text.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const h = m[1];
    bump([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  }
  for (const m of text.matchAll(/#([0-9a-fA-F]{3})\b/g)) {
    const h = m[1];
    bump([...h].map((c) => parseInt(c + c, 16)));
  }
  for (const m of text.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
    bump([Number(m[1]), Number(m[2]), Number(m[3])]);
  }
  return [...found.entries()].map(([key, weight]) => ({ rgb: key.split(',').map(Number), weight }));
}

async function fetchText(target) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(target, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Deneb4-BrandIngest/1.0' } });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

async function collectColors(pageUrl) {
  const html = await fetchText(pageUrl);
  if (!html) throw new Error(`Could not fetch ${pageUrl}`);
  let corpus = html;

  // Same-origin stylesheets carry most of the brand; cap at 6.
  const origin = new URL(pageUrl).origin;
  const hrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)]
    .concat([...html.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi)])
    .map((m) => m[1]);
  const cssUrls = [...new Set(hrefs)]
    .map((h) => {
      try {
        return new URL(h, pageUrl).href;
      } catch {
        return null;
      }
    })
    .filter((u) => u && u.startsWith(origin))
    .slice(0, 6);
  for (const cssUrl of cssUrls) corpus += '\n' + (await fetchText(cssUrl));

  return { colors: parseColorLiterals(corpus), stylesheets: cssUrls.length };
}

function derivePalette(colors) {
  if (colors.length === 0) throw new Error('No color literals found on the page.');
  const byWeight = [...colors].sort((a, b) => b.weight - a.weight);

  const chromatic = byWeight.filter((c) => saturation(c.rgb) >= 0.25 && luminance(c.rgb) > 0.02 && luminance(c.rgb) < 0.85);
  const lights = byWeight.filter((c) => luminance(c.rgb) >= 0.8 && saturation(c.rgb) < 0.25);
  const darks = byWeight.filter((c) => luminance(c.rgb) <= 0.05 || (luminance(c.rgb) <= 0.15 && saturation(c.rgb) < 0.6));

  // Accent: the most-used chromatic color that can carry white text-ish use.
  const accent = chromatic.find((c) => contrast(c.rgb, [255, 255, 255]) >= 2.5)?.rgb ?? chromatic[0]?.rgb ?? [15, 118, 110];
  const accentStrong =
    chromatic.map((c) => c.rgb).find((rgb) => rgb.join() !== accent.join() && contrast(rgb, [255, 255, 255]) > contrast(accent, [255, 255, 255]) && saturation(rgb) >= 0.25) ??
    scale(accent, 0.78);

  const bgSurface = lights[0]?.rgb ?? [255, 255, 255];
  const bgBase = lights.map((c) => c.rgb).find((rgb) => rgb.join() !== bgSurface.join()) ?? scale(bgSurface, 0.97);
  // Surface should be the lighter of the two.
  const [base, surface] = luminance(bgBase) > luminance(bgSurface) ? [bgSurface, bgBase] : [bgBase, bgSurface];

  const heading = darks[0]?.rgb ?? [15, 23, 42];
  // Body/muted: readable steps between heading and background.
  const body = darks.map((c) => c.rgb).find((rgb) => rgb.join() !== heading.join() && contrast(rgb, surface) >= 4.5) ?? scale(heading, 1.9).map((c, i) => clamp(Math.max(c, heading[i] + 36)));
  const muted = scale(body, 1.5).map((c, i) => clamp(Math.max(c, body[i] + 30)));

  return {
    '--accent': channels(accent),
    '--accent-strong': channels(accentStrong),
    '--bg-base': channels(base),
    '--bg-surface': channels(surface),
    '--text-heading': channels(heading),
    '--text-body': channels(body),
    '--text-muted': channels(muted),
  };
}

async function main() {
  console.log(`Reading brand colors from ${url} ...`);
  const { colors, stylesheets } = await collectColors(url);
  console.log(`Found ${colors.length} distinct color literals across the page + ${stylesheets} stylesheet(s).`);

  const theme = derivePalette(colors);
  console.log('\nProposed palette (space-separated RGB channels):');
  for (const [k, v] of Object.entries(theme)) console.log(`  ${k.padEnd(16)} ${v}`);

  // File it as a change proposal — Ridhi approves in the Workspace, with swatches.
  const envFile = path.join(REPO_ROOT, '.env.local');
  const agentKey = fs.existsSync(envFile)
    ? (fs.readFileSync(envFile, 'utf-8').match(/^AGENT_API_KEY=(.+)$/m) || [])[1]?.trim()
    : undefined;
  if (!agentKey) throw new Error('AGENT_API_KEY not found in .env.local; cannot file the proposal.');

  const res = await fetch(`${reportTo}/api/agents/changes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
    body: JSON.stringify({
      slug,
      action: 'propose',
      agent: 'concierge',
      summary: `Brand palette ingested from ${new URL(url).hostname}`,
      patch: { theme },
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Proposal was refused: ${data.error ?? res.status}`);
  console.log(`\nProposal filed for ${slug} (${data.proposal.id}).`);
  console.log('Review it in the Workspace — the panel shows the actual swatches. Approving applies it and rebuilds.');
}

main().catch((err) => {
  console.error(`\nBrand ingest failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});

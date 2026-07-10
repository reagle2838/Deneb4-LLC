import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Builder v2 integration with the real d4 template ecosystem
 * (github.com/deneb4admin). Ridhi's d4-site-builder is the assembly engine;
 * this module handles everything around it: mirroring the module repos,
 * invoking the assembler, deriving the QA manifest from d4.assembly.json,
 * env bootstrap, git-native init/commit, and the token-gated GitHub push.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const VENDOR_DIR = path.join(REPO_ROOT, 'vendor', 'd4');
export const BUILDS_DIR = path.join(REPO_ROOT, 'builds');
export const BUILD_CONFIGS_DIR = path.join(REPO_ROOT, 'content', 'build-configs');

/** The d4 ecosystem. d4-site-builder is the tool; the rest are modules. */
export const D4_REPOS = [
  'd4-site-builder',
  'd4-site-template',
  'd4-cms-core',
  'd4-careers-portal',
  'd4-insights-blog',
  'd4-catalog',
  'd4-gallery-editor',
];
const D4_GIT_BASE = 'https://github.com/deneb4admin';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

/**
 * Clone or fast-forward all d4 repos into vendor/d4/ and return the exact
 * commit SHA of each, so every build records precisely which template code
 * it was assembled from.
 * @returns {Record<string, string>} name -> full commit sha
 */
export function ensureMirror() {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  /** @type {Record<string,string>} */
  const shas = {};
  for (const name of D4_REPOS) {
    const dir = path.join(VENDOR_DIR, name);
    if (fs.existsSync(path.join(dir, '.git'))) {
      try {
        git(['pull', '--ff-only', '--quiet'], dir);
      } catch {
        // Offline or diverged: build from the existing mirror rather than fail.
        console.warn(`  mirror: could not update ${name}, using existing checkout`);
      }
    } else {
      console.log(`  mirror: cloning ${name}...`);
      git(['clone', '--depth', '1', '--quiet', `${D4_GIT_BASE}/${name}.git`, dir], REPO_ROOT);
    }
    shas[name] = git(['rev-parse', 'HEAD'], dir);
  }
  return shas;
}

/** @returns {Record<string, unknown>} the d4-format build config for a client */
export function loadBuildConfig(slug) {
  const file = path.join(BUILD_CONFIGS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No build config for "${slug}" (expected ${file}).`);
  }
  const cfg = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!cfg.siteName || !Array.isArray(cfg.modules)) {
    throw new Error(`Build config for "${slug}" must have siteName and modules[].`);
  }
  return cfg;
}

/**
 * Run Ridhi's assembler against the local mirror. The runner (not the config
 * file) decides the output directory: always builds/<slug>. Git-native
 * doctrine: an existing build is never wiped; re-assembly is refused.
 */
export async function assemble(slug, cfg) {
  const outDir = path.join(BUILDS_DIR, slug);
  if (fs.existsSync(outDir)) {
    throw new Error(
      `builds/${slug} already exists. Existing builds are never wiped (git-native); ` +
        `incremental changes come through the change loop. Remove the directory only if you mean to start over.`
    );
  }
  fs.mkdirSync(BUILDS_DIR, { recursive: true });

  const finalCfg = { ...cfg, output: outDir };
  const tmpCfg = path.join(BUILDS_DIR, `.tmp-${slug}-config.json`);
  fs.writeFileSync(tmpCfg, JSON.stringify(finalCfg, null, 2));

  const assembler = path.join(VENDOR_DIR, 'd4-site-builder', 'bin', 'assemble.mjs');
  try {
    const code = await new Promise((resolve) => {
      const child = spawn('node', [assembler, '--config', tmpCfg, '--modules-dir', VENDOR_DIR], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
      });
      child.on('close', (c) => resolve(c ?? 1));
      child.on('error', () => resolve(1));
    });
    if (code !== 0) throw new Error(`d4-site-builder assemble failed (exit ${code}).`);
  } finally {
    fs.rmSync(tmpCfg, { force: true });
  }
  return outDir;
}

/**
 * Derive the verify.mjs --manifest input from the assembler's per-site
 * d4.assembly.json. Dynamic routes ([param]) are skipped: they need seeded
 * content, which is authored post-deploy through /admin. Admin routes are
 * reduced to the /admin login page (deeper admin pages need a session).
 */
export function deriveQaManifest(outDir) {
  const record = JSON.parse(fs.readFileSync(path.join(outDir, 'd4.assembly.json'), 'utf-8'));
  const routes = Object.keys(record.routes || {});
  const publicRoutes = [];
  const gated = [];
  const skipped = [];
  for (const r of routes) {
    if (r.includes('[')) {
      skipped.push(r);
    } else if (r.startsWith('/admin')) {
      if (r === '/admin') gated.push({ path: '/admin', expect: [200] });
      else skipped.push(r);
    } else {
      publicRoutes.push(r);
    }
  }
  const manifest = { public: publicRoutes.sort(), gated, assets: [] };
  const file = path.join(outDir, 'qa-manifest.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return { file, manifest, skipped, record };
}

/**
 * cms-core fails closed without ADMIN_PASSWORD. Generate a strong one into
 * the build's .env.local (never logged, never sent to the ledger). Ridhi
 * rotates it at handoff per the rotate-before-use rule.
 */
export function writeEnvLocal(outDir) {
  const password = crypto.randomBytes(12).toString('base64url');
  const lines = [
    '# Generated by the Builder agent. Rotate before client handoff.',
    `ADMIN_PASSWORD=${password}`,
    '',
  ];
  fs.writeFileSync(path.join(outDir, '.env.local'), lines.join('\n'));
  return { envFile: path.join(outDir, '.env.local') };
}

/** Initialize the client repo and make the first commit. Returns short sha. */
export function gitInitCommit(outDir, message) {
  git(['init', '-b', 'main', '--quiet'], outDir);
  // .env.local (secrets) and build artifacts stay out of the client repo.
  const gi = path.join(outDir, '.gitignore');
  const extra = '\n# Builder-managed\n.env.local\nqa-manifest.json\n';
  fs.writeFileSync(gi, (fs.existsSync(gi) ? fs.readFileSync(gi, 'utf-8') : '') + extra);
  git(['add', '-A'], outDir);
  git(
    ['-c', 'user.name=Deneb4 Builder', '-c', 'user.email=agents@deneb4.com', 'commit', '--quiet', '-m', message],
    outDir
  );
  return git(['rev-parse', '--short', 'HEAD'], outDir);
}

/**
 * Token-gated GitHub push: dormant until GITHUB_TOKEN + GITHUB_OWNER are
 * configured. Creates a private repo d4-client-<slug> under the owner and
 * pushes main. Never throws; the Builder reports the outcome either way.
 * @returns {Promise<{ pushed: boolean, detail: string, url?: string }>}
 */
export async function maybePushToGitHub(slug, outDir) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  if (!token || !owner) {
    return { pushed: false, detail: 'Local repo only: GITHUB_TOKEN/GITHUB_OWNER not configured yet.' };
  }
  const repo = `d4-client-${slug}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'deneb4-builder',
  };
  try {
    // Org endpoint first; fall back to user endpoint for a personal account.
    let res = await fetch(`https://api.github.com/orgs/${owner}/repos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: repo, private: true, description: `Deneb4 client site: ${slug}` }),
    });
    if (res.status === 404) {
      res = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: repo, private: true, description: `Deneb4 client site: ${slug}` }),
      });
    }
    if (!res.ok && res.status !== 422) {
      // 422 = already exists, which is fine; anything else is a real failure.
      return { pushed: false, detail: `GitHub repo creation failed (${res.status}).` };
    }
    const remote = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    try {
      git(['remote', 'remove', 'origin'], outDir);
    } catch {
      /* no origin yet */
    }
    git(['remote', 'add', 'origin', remote], outDir);
    git(['push', '--quiet', '-u', 'origin', 'main'], outDir);
    return { pushed: true, detail: `Pushed to ${owner}/${repo}.`, url: `https://github.com/${owner}/${repo}` };
  } catch (err) {
    return { pushed: false, detail: `Push failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

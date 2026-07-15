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

/* ── The incremental change loop ─────────────────────────────────────────
 * A "change" = editing content/build-configs/<slug>.json (the single source
 * of truth for structure + identity + theme), then re-running the Builder.
 * The Builder assembles the NEW config into a temp dir using Ridhi's real
 * assembler (so all generation stays hers, nothing re-implemented), then
 * syncs only the config-owned artifacts and module payload deltas into the
 * client's existing repo. Everything else (manual edits, data/, uploads/)
 * is untouched. d4.applied-config.json in the client repo records what has
 * been applied, so an unchanged config is a clean no-op.
 */

/** Config-owned artifacts the assembler generates; synced on change. */
const SYNCED_ARTIFACTS = [
  'src/config/site.ts',
  'src/config/nav.generated.ts',
  'src/config/admin-panels.generated.tsx',
  'src/config/fonts.generated.ts',
  'src/config/design.generated.ts',
  'src/app/theme.css',
  '.env.example',
];
const APPLIED_CONFIG_FILE = 'd4.applied-config.json';

/** Strip fields that don't affect the build (comments, runner-owned output). */
export function normalizeConfig(cfg) {
  const { $comment, output, ...rest } = cfg;
  return rest;
}

export function readAppliedConfig(outDir) {
  const file = path.join(outDir, APPLIED_CONFIG_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeAppliedConfig(outDir, cfg) {
  fs.writeFileSync(
    path.join(outDir, APPLIED_CONFIG_FILE),
    JSON.stringify(normalizeConfig(cfg), null, 2) + '\n'
  );
}

/** All payload file paths (relative to site root) a module contributes. */
function listPayloadFiles(moduleName) {
  const filesDir = path.join(VENDOR_DIR, moduleName, 'files');
  /** @type {string[]} */
  const out = [];
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      if (fs.statSync(full).isDirectory()) walk(full, r);
      else out.push(r);
    }
  };
  if (fs.existsSync(filesDir)) walk(filesDir, '');
  return out;
}

function readModuleManifest(moduleName) {
  return JSON.parse(fs.readFileSync(path.join(VENDOR_DIR, moduleName, 'manifest.json'), 'utf-8'));
}

/** Compare two d4.assembly.json contents ignoring the assembledAt timestamp. */
function assemblyEqual(aRaw, bRaw) {
  try {
    const a = { ...JSON.parse(aRaw), assembledAt: '' };
    const b = { ...JSON.parse(bRaw), assembledAt: '' };
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Apply a config change to an existing client repo.
 * @returns {Promise<{ noop: boolean, summary: string, changed: string[], added: string[], removed: string[], pkgChanged: boolean }>}
 */
export async function applyChange(slug, cfg) {
  const outDir = path.join(BUILDS_DIR, slug);
  const applied = readAppliedConfig(outDir);
  const migration = applied === null;

  if (!migration && JSON.stringify(normalizeConfig(cfg)) === JSON.stringify(applied)) {
    return { noop: true, summary: 'Config unchanged; nothing to change.', changed: [], added: [], removed: [], pkgChanged: false };
  }

  // Assemble the NEW config into a temp dir with Ridhi's assembler.
  const tmpOut = path.join(BUILDS_DIR, `.tmp-change-${slug}`);
  fs.rmSync(tmpOut, { recursive: true, force: true });
  const tmpCfgFile = path.join(BUILDS_DIR, `.tmp-${slug}-change-config.json`);
  fs.writeFileSync(tmpCfgFile, JSON.stringify({ ...normalizeConfig(cfg), output: tmpOut }, null, 2));
  const assembler = path.join(VENDOR_DIR, 'd4-site-builder', 'bin', 'assemble.mjs');
  try {
    const code = await new Promise((resolve) => {
      const child = spawn('node', [assembler, '--config', tmpCfgFile, '--modules-dir', VENDOR_DIR], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
      });
      child.on('close', (c) => resolve(c ?? 1));
      child.on('error', () => resolve(1));
    });
    if (code !== 0) throw new Error(`d4-site-builder assemble failed (exit ${code}).`);

    // Module delta from the EXPANDED lists (assembler resolves requires).
    const newAssembly = JSON.parse(fs.readFileSync(path.join(tmpOut, 'd4.assembly.json'), 'utf-8'));
    const oldAssembly = JSON.parse(fs.readFileSync(path.join(outDir, 'd4.assembly.json'), 'utf-8'));
    const newMods = Object.keys(newAssembly.modules);
    const oldMods = Object.keys(oldAssembly.modules);
    const addedMods = newMods.filter((m) => !oldMods.includes(m));
    const removedMods = oldMods.filter((m) => !newMods.includes(m));

    const changed = [];

    // Removed modules: delete their payload files (manual edits to a removed
    // module's files go with it, that is what removal means).
    for (const mod of removedMods) {
      for (const rel of listPayloadFiles(mod)) {
        const target = path.join(outDir, rel);
        if (fs.existsSync(target)) {
          fs.rmSync(target);
          changed.push(`${rel} (removed with ${mod})`);
          // Prune now-empty parent directories, best effort.
          let dir = path.dirname(target);
          while (dir.startsWith(outDir) && dir !== outDir) {
            try {
              if (fs.readdirSync(dir).length) break;
              fs.rmdirSync(dir);
              dir = path.dirname(dir);
            } catch {
              break;
            }
          }
        }
      }
    }

    // Added modules: copy their payloads in, same as the assembler does.
    for (const mod of addedMods) {
      const filesDir = path.join(VENDOR_DIR, mod, 'files');
      fs.cpSync(filesDir, outDir, { recursive: true });
      changed.push(`payload of ${mod} (added)`);
    }

    // Sync config-owned artifacts, content-compared so untouched ones stay put.
    for (const rel of SYNCED_ARTIFACTS) {
      const from = path.join(tmpOut, rel);
      const to = path.join(outDir, rel);
      if (!fs.existsSync(from)) continue;
      const fresh = fs.readFileSync(from);
      if (!fs.existsSync(to) || !fresh.equals(fs.readFileSync(to))) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, fresh);
        changed.push(rel);
      }
    }

    // d4.assembly.json: compare ignoring the timestamp.
    const newAssemblyRaw = fs.readFileSync(path.join(tmpOut, 'd4.assembly.json'), 'utf-8');
    const oldAssemblyRaw = fs.readFileSync(path.join(outDir, 'd4.assembly.json'), 'utf-8');
    if (!assemblyEqual(newAssemblyRaw, oldAssemblyRaw)) {
      fs.writeFileSync(path.join(outDir, 'd4.assembly.json'), newAssemblyRaw);
      changed.push('d4.assembly.json');
    }

    // package.json: keep the repo's file (preserves manual additions), take
    // the fresh name, drop removed modules' deps, merge in the fresh deps.
    let pkgChanged = false;
    const pkgPath = path.join(outDir, 'package.json');
    const repoPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const tmpPkg = JSON.parse(fs.readFileSync(path.join(tmpOut, 'package.json'), 'utf-8'));
    const before = JSON.stringify(repoPkg);
    repoPkg.name = tmpPkg.name;
    for (const mod of removedMods) {
      const m = readModuleManifest(mod);
      for (const dep of Object.keys(m.npmDependencies ?? {})) delete repoPkg.dependencies?.[dep];
      for (const dep of Object.keys(m.npmDevDependencies ?? {})) delete repoPkg.devDependencies?.[dep];
    }
    repoPkg.dependencies = { ...(repoPkg.dependencies ?? {}), ...(tmpPkg.dependencies ?? {}) };
    repoPkg.devDependencies = { ...(repoPkg.devDependencies ?? {}), ...(tmpPkg.devDependencies ?? {}) };
    if (JSON.stringify(repoPkg) !== before) {
      fs.writeFileSync(pkgPath, JSON.stringify(repoPkg, null, 2) + '\n');
      changed.push('package.json');
      pkgChanged = true;
    }

    writeAppliedConfig(outDir, cfg);

    const parts = [];
    if (addedMods.length) parts.push(`added ${addedMods.join(', ')}`);
    if (removedMods.length) parts.push(`removed ${removedMods.join(', ')}`);
    const artifactOnly = changed.filter((c) => !c.includes('(added)') && !c.includes('(removed'));
    if (artifactOnly.length) parts.push(`updated ${artifactOnly.join(', ')}`);
    const summary = migration
      ? `Synced repo to build config (first change-loop run): ${parts.join('; ') || 'no differences found'}.`
      : `Applied config change: ${parts.join('; ') || 'no file differences'}.`;

    return { noop: changed.length === 0 && !migration, summary, changed, added: addedMods, removed: removedMods, pkgChanged };
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
    fs.rmSync(tmpCfgFile, { force: true });
  }
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

/** True if the client repo has uncommitted changes. */
export function gitIsDirty(outDir) {
  return git(['status', '--porcelain'], outDir).length > 0;
}

/** Commit everything currently changed in the client repo. Returns short sha. */
export function gitCommitAll(outDir, message) {
  git(['add', '-A'], outDir);
  git(
    ['-c', 'user.name=Deneb4 Builder', '-c', 'user.email=agents@deneb4.com', 'commit', '--quiet', '-m', message],
    outDir
  );
  return git(['rev-parse', '--short', 'HEAD'], outDir);
}

/** Revert the latest commit (used when QA rejects an applied change). */
export function gitRevertHead(outDir) {
  git(
    ['-c', 'user.name=Deneb4 Builder', '-c', 'user.email=agents@deneb4.com', 'revert', '--no-edit', 'HEAD'],
    outDir
  );
  return git(['rev-parse', '--short', 'HEAD'], outDir);
}

/** Pull latest from origin if a remote exists (picks up remote-side edits). */
export function gitPullIfRemote(outDir) {
  try {
    const remotes = git(['remote'], outDir);
    if (!remotes.split(/\r?\n/).includes('origin')) {
      return { pulled: false, detail: 'No remote configured; using the local repo as-is.' };
    }
    git(['pull', '--ff-only', '--quiet'], outDir);
    return { pulled: true, detail: 'Pulled latest from origin.' };
  } catch (err) {
    throw new Error(`Could not pull from origin (diverged or offline): ${err instanceof Error ? err.message : err}`);
  }
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
    // Identity guard: client repos hold client content and must land under
    // GITHUB_OWNER, never under whichever account happened to mint the
    // token. A personal-owner mismatch would otherwise silently create the
    // repo on the wrong account via the /user/repos fallback.
    const whoRes = await fetch('https://api.github.com/user', { headers });
    if (!whoRes.ok) {
      return { pushed: false, detail: `GITHUB_TOKEN is invalid (${whoRes.status}); repo not created.` };
    }
    const login = (await whoRes.json()).login;
    let ownerIsOrg = false;
    if (login.toLowerCase() !== owner.toLowerCase()) {
      const ownerRes = await fetch(`https://api.github.com/users/${owner}`, { headers });
      ownerIsOrg = ownerRes.ok && (await ownerRes.json()).type === 'Organization';
      if (!ownerIsOrg) {
        return {
          pushed: false,
          detail: `GITHUB_TOKEN belongs to "${login}" but GITHUB_OWNER is "${owner}" (a personal account). Refusing to create the repo under the wrong account; mint the token while signed in as ${owner}.`,
        };
      }
    }
    let res = await fetch(
      ownerIsOrg ? `https://api.github.com/orgs/${owner}/repos` : 'https://api.github.com/user/repos',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: repo, private: true, description: `Deneb4 client site: ${slug}` }),
      }
    );
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
    // credential.helper is disabled for this push: the URL already carries
    // the token, and letting GCM "approve" it caches an x-access-token
    // credential that shadows the user's own GitHub login machine-wide.
    git(['-c', 'credential.helper=', 'push', '--quiet', '-u', 'origin', 'main'], outDir);
    // Scrub the token from the stored remote; later pushes ride the
    // credential manager or re-embed it for the single push above.
    git(['remote', 'set-url', 'origin', `https://github.com/${owner}/${repo}.git`], outDir);
    return { pushed: true, detail: `Pushed to ${owner}/${repo}.`, url: `https://github.com/${owner}/${repo}` };
  } catch (err) {
    return { pushed: false, detail: `Push failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

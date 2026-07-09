import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Build manifests: routes.json (the QA contract), build-manifest.json
 * (resolved config echo + per-file hashes), and a change summary/diff vs the
 * previous build so the Builder can report "what changed" to the ledger.
 */

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Hash every file in outDir except the manifests themselves. */
export function hashOutput(outDir) {
  /** @type {Record<string,string>} */
  const hashes = {};
  const walk = (dir, base = '') => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = base ? `${base}/${name}` : name;
      if (fs.statSync(full).isDirectory()) walk(full, rel);
      else if (rel !== 'build-manifest.json') hashes[rel] = hashFile(full);
    }
  };
  walk(outDir);
  return hashes;
}

/** Read the hashes from a prior build-manifest.json, or {} if none. Call this
 * BEFORE cleaning the output dir so the change diff survives a rebuild. */
export function readPrevHashes(outDir) {
  const prevPath = path.join(outDir, 'build-manifest.json');
  if (!fs.existsSync(prevPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(prevPath, 'utf-8')).hashes || {};
  } catch {
    return {};
  }
}

/**
 * Write routes.json + build-manifest.json, and return the change summary vs
 * the previous manifest (whose hashes are passed in).
 * @returns {{ changedFiles: string[], summary: string }}
 */
export function writeManifests(outDir, { slug, resolvedConfig, routes, enabledModules, preset, accent, prevHashes = {} }) {
  fs.writeFileSync(path.join(outDir, 'routes.json'), JSON.stringify(routes, null, 2));

  const prevPath = path.join(outDir, 'build-manifest.json');
  const hashes = hashOutput(outDir);
  const changedFiles = [];
  for (const [f, h] of Object.entries(hashes)) if (prevHashes[f] !== h) changedFiles.push(f);
  for (const f of Object.keys(prevHashes)) if (!(f in hashes)) changedFiles.push(`${f} (removed)`);

  const manifest = {
    slug,
    builtAt: new Date().toISOString(),
    config: resolvedConfig,
    enabledModules,
    preset,
    accent: accent || null,
    routes,
    hashes,
  };
  fs.writeFileSync(prevPath, JSON.stringify(manifest, null, 2));

  const summary =
    `Assembled ${slug}: modules [${enabledModules.join(', ')}], preset ${preset}` +
    (accent ? `, accent ${accent}` : '') +
    `. Routes: ${routes.public.join(', ')}. ` +
    (changedFiles.length ? `${changedFiles.length} file(s) changed.` : 'No changes since last build.');

  return { changedFiles, summary };
}

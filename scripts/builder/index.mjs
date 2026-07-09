import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadTemplate } from './template.mjs';
import { loadBuildConfig, validateBuildConfig, BuildValidationError } from './config.mjs';
import { assemble } from './assemble.mjs';
import { readPrevHashes, writeManifests } from './manifest.mjs';

/**
 * runBuild: the deterministic Builder orchestrator (no HTTP, no ledger). It
 * validates and assembles a client into builds/<slug>/ and returns an
 * AssembleResult. Throws BuildValidationError on an invalid config (the runner
 * catches it and escalates). This is safe to import in-process later.
 */

export const BUILDS_DIR = path.join(REPO_ROOT, 'builds');

/**
 * @param {string} slug
 * @returns {Promise<import('./types.mjs').AssembleResult>}
 */
export async function runBuild(slug) {
  const cfg = loadBuildConfig(slug);
  const template = loadTemplate(cfg.template.id);

  const { ok, errors } = validateBuildConfig(cfg, template.descriptor);
  if (!ok) throw new BuildValidationError(errors);

  const outDir = path.join(BUILDS_DIR, slug);
  const prevHashes = readPrevHashes(outDir);
  fs.rmSync(outDir, { recursive: true, force: true });

  const a = await assemble(cfg, template, outDir);

  const { changedFiles, summary } = writeManifests(outDir, {
    slug,
    resolvedConfig: a.resolvedConfig,
    routes: a.routes,
    enabledModules: a.enabledModules,
    preset: a.preset,
    accent: a.accent,
    prevHashes,
  });

  return {
    slug,
    outDir,
    routes: a.routes,
    enabledModules: a.enabledModules,
    preset: a.preset,
    accent: a.accent,
    summary,
    changedFiles,
  };
}

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './template.mjs';

/**
 * Build-config loading + validation. Validation is the load-bearing safety
 * guarantee (configs will come from an external form/compiler later), and it
 * enforces the fact-slot rule: the engine may only assert facts the client
 * supplied, and a missing required slot is a HARD failure, never fabricated.
 */

export const BUILD_CONFIGS_DIR = path.join(REPO_ROOT, 'content', 'build-configs');
const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** @returns {import('./types.mjs').BuildConfig} */
export function loadBuildConfig(slug) {
  const file = path.join(BUILD_CONFIGS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No build config for "${slug}" (expected ${file}).`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * @param {import('./types.mjs').BuildConfig} cfg
 * @param {import('./types.mjs').TemplateDescriptor} template
 * @returns {import('./types.mjs').ValidationResult}
 */
export function validateBuildConfig(cfg, template) {
  const errors = [];
  const isStr = (v) => typeof v === 'string' && v.length > 0;

  if (cfg == null || typeof cfg !== 'object') return { ok: false, errors: ['Config is not an object.'] };
  if (cfg.schemaVersion !== 1) errors.push(`schemaVersion must be 1 (got ${JSON.stringify(cfg.schemaVersion)}).`);
  if (!isStr(cfg.client) || !SLUG_RE.test(cfg.client)) errors.push('client must be a valid lowercase slug.');
  if (!isStr(cfg.siteName)) errors.push('siteName is required.');
  if (!cfg.template || cfg.template.id !== template.id) {
    errors.push(`template.id must be "${template.id}".`);
  }

  const modules = cfg.modules && typeof cfg.modules === 'object' ? cfg.modules : {};
  const known = template.modules;

  // Only known modules may appear.
  for (const key of Object.keys(modules)) {
    if (!(key in known)) errors.push(`Unknown module "${key}" (not in template).`);
    else if (typeof modules[key] !== 'boolean') errors.push(`Module "${key}" must be a boolean.`);
  }
  // Required modules must be present and enabled.
  for (const [key, spec] of Object.entries(known)) {
    if (spec.required && modules[key] !== true) errors.push(`Module "${key}" is required and must be enabled.`);
  }

  const enabled = Object.keys(known).filter((k) => modules[k] === true);

  // Theme.
  const theme = cfg.theme || {};
  if (!isStr(theme.preset) || !(theme.preset in template.presets)) {
    errors.push(`theme.preset must be one of: ${Object.keys(template.presets).join(', ')}.`);
  }
  if (theme.accent != null && !ACCENT_RE.test(theme.accent)) {
    errors.push('theme.accent must be a #rrggbb hex color.');
  }
  if (theme.layout != null && template.layouts.length && !template.layouts.includes(theme.layout)) {
    errors.push(`theme.layout must be one of: ${template.layouts.join(', ')}.`);
  }

  // Fact-slot rule.
  const copy = cfg.copy && typeof cfg.copy === 'object' ? cfg.copy : {};
  const knownSlots = new Set();
  for (const key of enabled) {
    const spec = known[key];
    for (const [slotId, req] of Object.entries(spec.slots)) {
      knownSlots.add(slotId);
      if (req === 'required' && !isStr(copy[slotId])) {
        errors.push(`Missing required copy slot "${slotId}" for enabled module "${key}".`);
      }
    }
  }
  // Every supplied copy key must belong to an enabled module's slots.
  for (const slotId of Object.keys(copy)) {
    if (!knownSlots.has(slotId)) {
      errors.push(`Copy slot "${slotId}" does not belong to any enabled module (would inject unused/unknown copy).`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export class BuildValidationError extends Error {
  /** @param {string[]} errors */
  constructor(errors) {
    super(`Build config invalid:\n- ${errors.join('\n- ')}`);
    this.name = 'BuildValidationError';
    this.errors = errors;
  }
}

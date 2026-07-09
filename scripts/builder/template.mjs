import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Template loading. Templates live under templates/<id>/ and are described
 * by template.json (the descriptor the assembler and validator read). The
 * descriptor is the ONLY thing the Builder core knows about a template, so
 * the stub stays swappable: drop in a real template with its own
 * template.json and the engine is unchanged.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const TEMPLATES_DIR = path.join(REPO_ROOT, 'templates');

/** @returns {{ id: string, dir: string, descriptor: import('./types.mjs').TemplateDescriptor }} */
export function loadTemplate(id) {
  const dir = path.join(TEMPLATES_DIR, id);
  const descriptorPath = path.join(dir, 'template.json');
  if (!fs.existsSync(descriptorPath)) {
    throw new Error(`Template "${id}" not found (no ${descriptorPath}).`);
  }
  const descriptor = JSON.parse(fs.readFileSync(descriptorPath, 'utf-8'));
  return { id, dir, descriptor };
}

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { validateBundle, type TemplateBundle, type BundleFile } from '../../packages/template-kit/index.mjs';
import { writeBundleToDir, bundleFromDir } from '../../packages/template-kit/node.mjs';

/**
 * The studio's template library: Ridhi's no-code path from "an AI generated
 * a template repo for me" to "validated, stored, and portable".
 *
 * A template ships as a zip of the repo layout the authoring rulebook
 * specifies (manifest.json at the root, payload under files/). Import
 * unpacks in memory, runs the FULL template-kit gate (manifest schema, path
 * safety, required site files, theme-token lint), and only then writes to
 * content/templates/<name>/ + the registry. Errors reject the upload;
 * warnings import and stay on the record for review.
 *
 * Deneb4's Builder still assembles from the d4 catalog: wiring imported
 * base templates into d4-site-builder (a `template` field on the build
 * config + a registry entry) is the recorded engine follow-up. Imported
 * templates are ALREADY usable on Stardrive — "Send to Stardrive" posts the
 * same bundle to the Stardrive API's import endpoint.
 */

const TEMPLATES_DIR = path.join(process.cwd(), 'content', 'templates');
const REGISTRY_PATH = path.join(process.cwd(), 'content', 'admin', 'template-registry.json');
const TEXT_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|css|json|md|svg|txt|html|yml|yaml)$/i;
const MAX_ZIP_BYTES = 30_000_000;

export interface TemplateRecord {
  name: string;
  version: string;
  kind: string;
  description: string;
  importedAt: string;
  warnings: string[];
  source: 'upload';
}

export function listTemplates(): TemplateRecord[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as TemplateRecord[];
}

function saveRegistry(records: TemplateRecord[]) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(records, null, 2) + '\n');
}

function assertLibraryName(name: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) throw new Error(`Bad template name ${JSON.stringify(name)}.`);
  return name;
}

/** Zip (base64) → TemplateBundle. Handles a single wrapping root folder. */
export function bundleFromZip(zipBase64: string): TemplateBundle {
  const buf = Buffer.from(zipBase64, 'base64');
  if (buf.length > MAX_ZIP_BYTES) throw new Error(`Zip exceeds the ${MAX_ZIP_BYTES / 1_000_000} MB cap.`);
  const zip = new AdmZip(buf);
  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory)
    .map((e) => ({ name: e.entryName.replace(/\\/g, '/'), data: e.getData() }))
    .filter((e) => !/(^|\/)(__MACOSX|\.DS_Store)(\/|$)/.test(e.name));
  if (!entries.length) throw new Error('The zip is empty.');

  // If everything lives under one root folder (how OS zippers usually pack
  // a folder), strip it.
  const firstSeg = entries[0].name.split('/')[0];
  const wrapped = entries.length > 1 || entries[0].name.includes('/')
    ? entries.every((e) => e.name.split('/')[0] === firstSeg && e.name.includes('/'))
    : false;
  const names = (n: string) => (wrapped ? n.split('/').slice(1).join('/') : n);

  const manifestEntry = entries.find((e) => names(e.name) === 'manifest.json');
  if (!manifestEntry) {
    throw new Error('No manifest.json at the template root — the rulebook requires it (repo layout: manifest.json + files/…).');
  }
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestEntry.data.toString('utf-8')) as Record<string, unknown>;
  } catch {
    throw new Error('manifest.json is not valid JSON.');
  }

  // Payload: files/** when present (the rulebook layout); otherwise every
  // non-manifest entry, taken as already payload-relative.
  const hasFilesDir = entries.some((e) => names(e.name).startsWith('files/'));
  const files: BundleFile[] = [];
  for (const e of entries) {
    const rel = names(e.name);
    if (rel === 'manifest.json') continue;
    const payloadPath = hasFilesDir ? (rel.startsWith('files/') ? rel.slice(6) : null) : rel;
    if (!payloadPath) continue; // repo docs (README etc.) outside files/ are not payload
    if (TEXT_EXT_RE.test(payloadPath)) files.push({ path: payloadPath, content: e.data.toString('utf-8') });
    else files.push({ path: payloadPath, contentBase64: e.data.toString('base64') });
  }
  return { manifest, files };
}

export interface ImportResult {
  ok: boolean;
  name?: string;
  existed?: boolean;
  errors: string[];
  warnings: string[];
}

export function importTemplateZip(zipBase64: string): ImportResult {
  let bundle: TemplateBundle;
  try {
    bundle = bundleFromZip(zipBase64);
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)], warnings: [] };
  }
  const v = validateBundle(bundle);
  if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };

  const name = assertLibraryName(String(bundle.manifest.name));
  const dest = path.join(TEMPLATES_DIR, name);
  const existed = fs.existsSync(dest);
  if (existed) fs.rmSync(dest, { recursive: true, force: true });
  writeBundleToDir(bundle, dest);

  const records = listTemplates().filter((r) => r.name !== name);
  records.push({
    name,
    version: String(bundle.manifest.version ?? ''),
    kind: String(bundle.manifest.kind ?? ''),
    description: String(bundle.manifest.description ?? ''),
    importedAt: new Date().toISOString(),
    warnings: v.warnings,
    source: 'upload',
  });
  records.sort((a, b) => a.name.localeCompare(b.name));
  saveRegistry(records);
  return { ok: true, name, existed, errors: [], warnings: v.warnings };
}

export function deleteTemplate(name: string): boolean {
  assertLibraryName(name);
  const records = listTemplates();
  if (!records.some((r) => r.name === name)) return false;
  fs.rmSync(path.join(TEMPLATES_DIR, name), { recursive: true, force: true });
  saveRegistry(records.filter((r) => r.name !== name));
  return true;
}

/** Post a stored template to the Stardrive API's import endpoint. */
export async function pushTemplateToStardrive(name: string): Promise<{ status: number; body: unknown }> {
  assertLibraryName(name);
  const url = (process.env.STARDRIVE_API_URL || '').replace(/\/$/, '');
  const key = process.env.STARDRIVE_API_KEY || '';
  if (!url || !key) {
    throw new Error('Set STARDRIVE_API_URL and STARDRIVE_API_KEY in .env.local first (mint the key with the Stardrive API\'s make-key.mjs).');
  }
  const dir = path.join(TEMPLATES_DIR, name);
  if (!fs.existsSync(dir)) throw new Error(`Template "${name}" is not in the library.`);
  const bundle = bundleFromDir(dir);
  const res = await fetch(`${url}/v1/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(bundle),
  });
  return { status: res.status, body: await res.json() };
}

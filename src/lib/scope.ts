/**
 * The in-house scope agreement (replaces the Google Apps Script scope-doc
 * + e-signature + PDF-lock flow, per Ridhi's decision 2026-07-16: a simple
 * click-to-sign rather than a paid e-signature API — no external
 * dependency, no per-envelope cost).
 *
 * A scope document is generated from the client's CONFIRMED quote (the
 * same moment Phase 14's quote-confirmation gate fires) and signed in the
 * same action: the client types their full name alongside the portal
 * Approve click. Once signed, the record is locked — the content can never
 * be edited again, mirroring GAS's "convert to PDF, delete the editable
 * copy" pattern with an immutability flag instead of a file-format change.
 * A later scope change (an approved config change) creates a NEW version,
 * never mutates a signed one.
 *
 * Legal note (not legal advice): a typed name + timestamp + IP, captured
 * with clear "I agree" intent, is a common baseline for ESIGN Act/UETA
 * compliance for ordinary business agreements. Worth a one-time attorney
 * sanity check before relying on it for anything unusually high-stakes.
 */
import fs from 'fs';
import path from 'path';
import { assertSafeSlug } from '@/lib/agent-auth';
import { money, type Quote } from '@/lib/pricing';

const SCOPE_DIR = path.join(process.cwd(), 'content', 'admin', 'scope');
const scopePath = (slug: string, version: number) => path.join(SCOPE_DIR, `${assertSafeSlug(slug)}-v${version}.json`);
const indexPath = (slug: string) => path.join(SCOPE_DIR, `${assertSafeSlug(slug)}.index.json`);

export interface ScopeDocument {
  slug: string;
  version: number;
  generatedAt: string;
  content: string; // Plain-text/markdown scope summary; immutable once signed.
  siteName: string;
  total: number;
  signature: {
    signedAt: string;
    typedName: string;
    ip: string;
  } | null;
}

function currentVersion(slug: string): number {
  const file = indexPath(slug);
  if (!fs.existsSync(file)) return 0;
  try {
    return (JSON.parse(fs.readFileSync(file, 'utf-8')) as { version: number }).version ?? 0;
  } catch {
    return 0;
  }
}

function setCurrentVersion(slug: string, version: number) {
  fs.mkdirSync(SCOPE_DIR, { recursive: true });
  fs.writeFileSync(indexPath(slug), JSON.stringify({ version }, null, 2));
}

export function getScopeDocument(slug: string): ScopeDocument | null {
  const version = currentVersion(slug);
  if (version === 0) return null;
  const file = scopePath(slug, version);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ScopeDocument;
  } catch {
    return null;
  }
}

function renderScope(siteName: string, quote: Quote, adjustmentUsd: number): string {
  const total = Math.round((quote.total + adjustmentUsd) * 100) / 100;
  const lines = quote.lines.map((l) => `- ${l.label}: ${money(l.amount)}`);
  if (adjustmentUsd) lines.push(`- Adjustment: ${money(adjustmentUsd)}`);
  return [
    `# Project Scope Agreement — ${siteName}`,
    '',
    `Prepared by Deneb4 LLC. This document describes what is included in the project and its price.`,
    '',
    '## What is included',
    ...lines,
    '',
    `**Total: ${money(total)}** — 50% (${money(Math.round((total / 2) * 100) / 100)}) due before work begins, balance due at handoff.`,
    '',
    'Work begins once the deposit above is received. Changes beyond what is listed here are scoped and priced separately before they are built.',
  ].join('\n');
}

/**
 * Generate the scope document for the client's currently confirmed quote.
 * Idempotent when an UNSIGNED version already exists (returns it unchanged
 * rather than minting a new version) — this is what keeps a duplicate
 * approve call (a double-click, a client retry, or a dev-server first-
 * compile double-invoke) from orphaning versions before anyone signs one.
 * Refuses to overwrite a SIGNED document; call this again only after a
 * scope-changing config edit, which intentionally starts a new version.
 */
export function generateScopeDocument(
  slug: string,
  siteName: string,
  quote: Quote,
  adjustmentUsd: number
): ScopeDocument {
  assertSafeSlug(slug);
  const existing = getScopeDocument(slug);
  if (existing && !existing.signature) return existing;
  const version = currentVersion(slug) + 1;
  const doc: ScopeDocument = {
    slug,
    version,
    generatedAt: new Date().toISOString(),
    content: renderScope(siteName, quote, adjustmentUsd),
    siteName,
    total: Math.round((quote.total + adjustmentUsd) * 100) / 100,
    signature: null,
  };
  fs.mkdirSync(SCOPE_DIR, { recursive: true });
  fs.writeFileSync(scopePath(slug, version), JSON.stringify(doc, null, 2));
  setCurrentVersion(slug, version);
  return doc;
}

/** Sign + lock the current scope document. Idempotent-safe: refuses a second signature. */
export function signScopeDocument(slug: string, typedName: string, ip: string): ScopeDocument | null {
  const doc = getScopeDocument(slug);
  if (!doc || doc.signature) return null;
  doc.signature = { signedAt: new Date().toISOString(), typedName: typedName.trim().slice(0, 200), ip };
  fs.writeFileSync(scopePath(slug, doc.version), JSON.stringify(doc, null, 2));
  return doc;
}

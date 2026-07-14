import crypto from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * Shared server-side auth + input-safety helpers for the agent API routes.
 * Centralized so the timing-safe key check and slug validation are done one
 * correct way everywhere, not re-implemented (subtly differently) per route.
 */

/**
 * Constant-time check of the x-agent-key header against AGENT_API_KEY.
 * Uses crypto.timingSafeEqual so a `===` comparison can't leak the key one
 * character at a time via response timing. Returns false when the key isn't
 * configured (fail closed).
 */
export function hasAgentKey(req: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY;
  const provided = req.headers.get('x-agent-key');
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  // timingSafeEqual throws on length mismatch, so guard length first — but
  // still do the compare to keep timing independent of a length-only miss.
  if (a.length !== b.length) {
    // Compare expected against itself so timing doesn't reveal a length hit.
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * The single definition of a valid client slug / ledger channel: lowercase
 * alphanumerics and hyphens, 1–64 chars, must start alphanumeric. Anything
 * else — path separators, `..`, dots, spaces — is rejected, which is what
 * keeps a slug from escaping its content/ directory when interpolated into a
 * file path.
 */
export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug);
}

/** Fail-closed guard for path builders: throws on any unsafe slug. */
export function assertSafeSlug(slug: unknown): string {
  if (!isValidSlug(slug)) throw new Error('Invalid slug: refusing to build a file path from untrusted input.');
  return slug;
}

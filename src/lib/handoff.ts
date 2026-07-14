import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Client } from './clients';
import { appendLedger } from './agent-ledger';
import { assertSafeSlug } from './agent-auth';

/**
 * The handoff package (docs/agents.md: Concierge produces the "handover
 * doc (credentials, rotate-before-use)"; leaving `handoff` is gated on
 * Ridhi reviewing this doc).
 *
 * Generating a package ROTATES the assembled site's admin password first
 * (the Builder's original one dies here, so nothing that existed during
 * the build ships to the client), writes a markdown handover doc with the
 * fresh credential + an explicit change-on-first-login instruction + the
 * handoff checklist, and records everything except the secret on the
 * ledger. The doc lands in content/admin/handoffs/ which is GITIGNORED —
 * it contains a credential and must never be committed. Delivery is
 * Ridhi's: she reviews the doc (her gate) and hands it over on a channel
 * she trusts.
 */

const HANDOFFS_DIR = path.join(process.cwd(), 'content', 'admin', 'handoffs');
const BUILDS_DIR = path.join(process.cwd(), 'builds');

export function handoffDocPath(slug: string): string {
  return path.join(HANDOFFS_DIR, `${assertSafeSlug(slug)}.md`);
}

export function getHandoffDoc(slug: string): { doc: string; generatedAt: string } | null {
  const file = handoffDocPath(slug);
  if (!fs.existsSync(file)) return null;
  return { doc: fs.readFileSync(file, 'utf-8'), generatedAt: fs.statSync(file).mtime.toISOString() };
}

/**
 * Rotate ADMIN_PASSWORD in the client build's .env.local. Returns the new
 * password, or null when there is no local build to rotate.
 */
function rotateAdminPassword(slug: string): string | null {
  const envFile = path.join(BUILDS_DIR, slug, '.env.local');
  if (!fs.existsSync(envFile)) return null;
  const fresh = crypto.randomBytes(12).toString('base64url');
  const lines = fs.readFileSync(envFile, 'utf-8').split(/\r?\n/);
  let replaced = false;
  const next = lines.map((l) => {
    if (l.startsWith('ADMIN_PASSWORD=')) {
      replaced = true;
      return `ADMIN_PASSWORD=${fresh}`;
    }
    return l;
  });
  if (!replaced) next.unshift(`ADMIN_PASSWORD=${fresh}`);
  fs.writeFileSync(envFile, next.join('\n'));
  return fresh;
}

function assembledModules(slug: string): string[] {
  try {
    const asm = JSON.parse(
      fs.readFileSync(path.join(BUILDS_DIR, slug, 'd4.assembly.json'), 'utf-8')
    ) as { modules?: Record<string, string> };
    return Object.keys(asm.modules ?? {});
  } catch {
    return [];
  }
}

export function generateHandoffPackage(client: Client): { doc: string; rotated: boolean } {
  const slug = client.slug;
  const hasBuild = fs.existsSync(path.join(BUILDS_DIR, slug));
  const password = hasBuild ? rotateAdminPassword(slug) : null;
  const modules = hasBuild ? assembledModules(slug) : [];
  const githubOwner = process.env.GITHUB_OWNER;
  const repoLine = githubOwner
    ? `https://github.com/${githubOwner}/d4-client-${slug} (private)`
    : `Local repository at builds/${slug} (GitHub transfer happens when the push layer is configured)`;
  const today = new Date().toISOString().slice(0, 10);
  const liveUrl = client.staging.url || '';
  const siteLine = liveUrl || '(production URL — fill in at deploy)';
  const adminLine = liveUrl ? `${liveUrl.replace(/\/$/, '')}/admin` : '(production URL)/admin — fill in at deploy';

  const doc = `# Handover — ${client.projectName || client.name}

Prepared ${today} by Deneb4 LLC for ${client.name} (${client.email || 'email on file'}).

## What you own

Your website is yours outright: the code, the content, and the admin
dashboard. There is no platform subscription keeping it alive and no
vendor lock-in. This document is your key ring.

- **Site**: ${siteLine}
- **Code repository**: ${repoLine}
${modules.length ? `- **Installed modules**: ${modules.join(', ')}` : ''}

## Admin dashboard credentials

- **Dashboard**: ${adminLine}
- **Password**: ${password ?? '(no local build found — rotate and record the credential by hand)'}

> **Change this password the first time you log in.** It was generated
> fresh for this handover — nobody used it during the build — but a
> credential that traveled in a document should never stay in service.
> Dashboard → Settings → Change password.

## Handoff checklist

- [${password ? 'x' : ' '}] Admin password rotated for handover (build-time credential retired)
- [ ] Client confirmed dashboard login works
- [ ] Client changed the password on first login
- [ ] Repository ownership transferred${githubOwner ? '' : ' (pending GitHub configuration)'}
- [ ] DNS / domain pointed at production hosting
- [ ] Final invoice paid (verified before this stage)
- [ ] Client told where support/maintenance requests go

## Support

Questions, changes, or maintenance: reply to your project thread in the
portal, or email hello@deneb4.com. We keep the build recipe on file, so
future changes are quick.
`;

  if (!fs.existsSync(HANDOFFS_DIR)) fs.mkdirSync(HANDOFFS_DIR, { recursive: true });
  fs.writeFileSync(handoffDocPath(slug), doc, 'utf-8');

  appendLedger(slug, {
    agent: 'concierge',
    kind: 'handoff',
    message:
      `Handoff package generated${password ? ' and the site admin password was ROTATED (build-time credential retired)' : ' — note: no local build found, so no credential was rotated'}. ` +
      `The doc (credentials + checklist) is at content/admin/handoffs/${slug}.md — gitignored, never committed. ` +
      `Review it, deliver it to the client on a channel you trust, and work the checklist; leaving Handoff stays your gate.`,
    data: { rotated: String(Boolean(password)), modules: modules.join(',') },
  });

  return { doc, rotated: Boolean(password) };
}

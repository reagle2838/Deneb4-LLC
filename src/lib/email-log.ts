import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

/**
 * Per-client email log: WHAT every project email actually said, not just
 * that one went out. The ledger keeps one-line summaries; this keeps the
 * subject and the real text (plain text, tags stripped) so "what exactly
 * was the client told?" always has an answer. Console-fallback sends
 * (no Resend key) are logged too, marked delivered:false — the content
 * record matters either way. One YAML per client under
 * content/admin/emails/. Server-only.
 */

export interface EmailRecord {
  id: string;
  date: string; // ISO
  direction: 'to-client' | 'to-owner';
  subject: string;
  text: string;
  delivered: boolean;
}

const DIR = path.join(process.cwd(), 'content', 'admin', 'emails');
const filePath = (slug: string) => path.join(DIR, `${slug}.yaml`);

export function getEmailLog(slug: string): EmailRecord[] {
  const file = filePath(slug);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = yamlLoad(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(raw) ? (raw as EmailRecord[]) : [];
  } catch {
    return [];
  }
}

const stripTags = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export function logEmail(
  slug: string,
  input: { direction: EmailRecord['direction']; subject: string; textParts: string[]; delivered: boolean }
): void {
  const record: EmailRecord = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    direction: input.direction,
    subject: input.subject.slice(0, 300),
    text: stripTags(input.textParts.filter(Boolean).join('\n')).slice(0, 4000),
    delivered: input.delivered,
  };
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(filePath(slug), yamlDump([...getEmailLog(slug), record], { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

import fs from 'fs';
import path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

export interface QuickLink {
  label: string;
  url: string;
  icon: string;
}

const FILE = path.join(process.cwd(), 'content', 'admin', 'quick-links.yaml');

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function getQuickLinks(): QuickLink[] {
  if (!fs.existsSync(FILE)) return [];
  try {
    const data = yamlLoad(fs.readFileSync(FILE, 'utf-8')) as { links?: unknown } | null;
    const raw = Array.isArray(data?.links) ? (data!.links as unknown[]) : [];
    return raw
      .map((l) => {
        const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
        return { label: str(o.label), url: str(o.url), icon: str(o.icon) || '🔗' };
      })
      .filter((l) => l.url);
  } catch {
    return [];
  }
}

export function writeQuickLinks(links: QuickLink[]): void {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const clean = links
    .map((l) => ({ label: l.label.trim(), url: l.url.trim(), icon: (l.icon || '🔗').trim() }))
    .filter((l) => l.url);
  fs.writeFileSync(FILE, yamlDump({ links: clean }, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

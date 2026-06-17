import fs from 'fs';
import path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

const FILE = path.join(process.cwd(), 'content', 'admin', 'notes.yaml');

export function getNotes(): string {
  if (!fs.existsSync(FILE)) return '';
  try {
    const data = yamlLoad(fs.readFileSync(FILE, 'utf-8')) as { text?: unknown } | null;
    return typeof data?.text === 'string' ? data.text : '';
  } catch {
    return '';
  }
}

export function writeNotes(text: string): void {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, yamlDump({ text }, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

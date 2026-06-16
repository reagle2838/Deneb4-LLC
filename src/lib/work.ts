import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import { marked } from 'marked';

const reader = createReader(process.cwd(), keystaticConfig);

export interface WorkProject {
  slug: string;
  title: string;
  sector: string;
  summary: string;
  tags: string[];
  status: 'live' | 'in-progress';
  date: string;
  liveUrl?: string;
  body: string;
}

function parseEntry(slug: string, entry: Awaited<ReturnType<typeof reader.collections.work.read>>): WorkProject | null {
  if (!entry) return null;
  return {
    slug,
    title: entry.title,
    sector: entry.sector,
    summary: entry.summary,
    tags: entry.tags ? entry.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    status: entry.status as WorkProject['status'],
    date: entry.date ?? '',
    ...(entry.liveUrl ? { liveUrl: entry.liveUrl } : {}),
    body: marked.parse(entry.body ?? '') as string,
  };
}

export async function getAllProjects(): Promise<WorkProject[]> {
  const slugs = await reader.collections.work.list();
  const projects: WorkProject[] = [];
  for (const slug of slugs) {
    const entry = await reader.collections.work.read(slug);
    const project = parseEntry(slug, entry);
    if (project) projects.push(project);
  }
  return projects.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getProjectBySlug(slug: string): Promise<WorkProject | null> {
  const entry = await reader.collections.work.read(slug);
  return parseEntry(slug, entry);
}

export async function getAllProjectSlugs(): Promise<string[]> {
  return reader.collections.work.list();
}

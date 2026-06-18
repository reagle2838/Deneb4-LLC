import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import type { DocumentRendererProps } from '@keystatic/core/renderer';

const reader = createReader(process.cwd(), keystaticConfig);

const readResolved = (slug: string) => reader.collections.work.read(slug, { resolveLinkedFiles: true });
type WorkEntry = NonNullable<Awaited<ReturnType<typeof readResolved>>>;

export type WorkBody = DocumentRendererProps['document'];

export interface WorkImage {
  src: string;
  caption: string;
}

export interface WorkProject {
  slug: string;
  title: string;
  sector: string;
  summary: string;
  tags: string[];
  status: 'live' | 'in-progress';
  date: string;
  liveUrl?: string;
  coverImage: string | null;
  gallery: WorkImage[];
  body: WorkBody;
}

function parseEntry(slug: string, entry: WorkEntry): WorkProject {
  return {
    slug,
    title: entry.title,
    sector: entry.sector,
    summary: entry.summary,
    tags: entry.tags ? entry.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    status: entry.status as WorkProject['status'],
    date: entry.date ?? '',
    ...(entry.liveUrl ? { liveUrl: entry.liveUrl } : {}),
    coverImage: entry.coverImage ?? null,
    gallery: (entry.gallery ?? [])
      .map((g) => ({ src: g.image ?? '', caption: g.caption ?? '' }))
      .filter((g) => g.src),
    body: (entry.body ?? []) as WorkBody,
  };
}

export async function getAllProjects(): Promise<WorkProject[]> {
  const slugs = await reader.collections.work.list();
  const projects: WorkProject[] = [];
  for (const slug of slugs) {
    const entry = await readResolved(slug);
    if (entry) projects.push(parseEntry(slug, entry));
  }
  return projects.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getProjectBySlug(slug: string): Promise<WorkProject | null> {
  const entry = await readResolved(slug);
  return entry ? parseEntry(slug, entry) : null;
}

export async function getAllProjectSlugs(): Promise<string[]> {
  return reader.collections.work.list();
}

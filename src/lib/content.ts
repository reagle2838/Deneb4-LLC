import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import type { Article, ArticleBody } from '@/types';

const reader = createReader(process.cwd(), keystaticConfig);

const readResolved = (slug: string) => reader.collections.articles.read(slug, { resolveLinkedFiles: true });
type ArticleEntry = NonNullable<Awaited<ReturnType<typeof readResolved>>>;

function parseEntry(slug: string, entry: ArticleEntry): Article {
  return {
    slug,
    title: entry.title,
    subtitle: entry.subtitle,
    type: entry.type as Article['type'],
    topic: entry.topic,
    date: entry.date ?? '',
    readTime: entry.readTime,
    coverImage: entry.coverImage ?? null,
    body: (entry.body ?? []) as ArticleBody,
  };
}

export async function getAllArticles(): Promise<Article[]> {
  const slugs = await reader.collections.articles.list();
  const results = await Promise.all(
    slugs.map(async (slug) => {
      const entry = await readResolved(slug);
      return entry ? parseEntry(slug, entry) : null;
    })
  );
  return results
    .filter((a): a is Article => a !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const entry = await readResolved(slug);
  return entry ? parseEntry(slug, entry) : null;
}

export async function getAllArticleSlugs(): Promise<string[]> {
  return reader.collections.articles.list();
}

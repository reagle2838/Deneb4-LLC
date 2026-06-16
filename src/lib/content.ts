import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import { marked } from 'marked';
import type { Article } from '@/types';

const reader = createReader(process.cwd(), keystaticConfig);

export async function getAllArticles(): Promise<Article[]> {
  const slugs = await reader.collections.articles.list();
  const results = await Promise.all(
    slugs.map(async (slug) => {
      const entry = await reader.collections.articles.read(slug);
      if (!entry) return null;
      return {
        slug,
        title: entry.title,
        subtitle: entry.subtitle,
        type: entry.type as Article['type'],
        topic: entry.topic,
        date: entry.date ?? '',
        readTime: entry.readTime,
        body: marked.parse(entry.body) as string,
      } satisfies Article;
    })
  );
  return results
    .filter((a): a is Article => a !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const entry = await reader.collections.articles.read(slug);
  if (!entry) return null;
  return {
    slug,
    title: entry.title,
    subtitle: entry.subtitle,
    type: entry.type as Article['type'],
    topic: entry.topic,
    date: entry.date ?? '',
    readTime: entry.readTime,
    body: marked.parse(entry.body) as string,
  };
}

export async function getAllArticleSlugs(): Promise<string[]> {
  return reader.collections.articles.list();
}

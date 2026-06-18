// ── Shared types ─────────────────────────────────────────────────────

import type { DocumentRendererProps } from "@keystatic/core/renderer";

export type ArticleType = "Article" | "Case Study";

export type ArticleBody = DocumentRendererProps["document"];

export interface Article {
  slug: string;
  title: string;
  subtitle: string;
  type: ArticleType;
  topic: string;
  date: string;       // ISO yyyy-mm-dd
  readTime: string;   // e.g. "6 min read"
  coverImage: string | null;
  /** Keystatic document nodes rendered with <DocumentRenderer />. */
  body: ArticleBody;
}

export interface ServicePackage {
  id: string;
  name: string;
  price: string;
  tagline: string;
  pages: string;
  revisions: string;
  delivery: string;
  toolCredits: string;
  aio: string;
  features: string[];
  featured?: boolean;
}

export interface FunctionalTool {
  label: string;
  price: string;
  desc: string;
}

export interface Industry {
  slug: string;
  label: string;
  spec: string;
  blurb: string;
}

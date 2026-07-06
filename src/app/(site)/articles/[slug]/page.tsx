import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { DocumentRenderer } from "@keystatic/core/renderer";
import Reveal from "@/components/motion/Reveal";
import Stagger from "@/components/motion/Stagger";
import { getAllArticles, getArticleBySlug, getAllArticleSlugs } from "@/lib/content";

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.subtitle,
    alternates: { canonical: `https://deneb4.com/articles/${article.slug}` },
    openGraph: { title: article.title, description: article.subtitle, type: "article" },
  };
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const allArticles = await getAllArticles();
  const more = allArticles.filter((a) => a.slug !== article.slug).slice(0, 2);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.subtitle,
    datePublished: article.date,
    author: { "@type": "Organization", name: "Deneb4" },
    publisher: { "@type": "Organization", name: "Deneb4" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <article>
        {/* Header */}
        <header className="bg-grid" style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-accent)" }}>
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <Link href="/articles" className="hero-rise font-spec text-xs mb-6 inline-block" style={{ color: "var(--accent-light)" }}>← All articles</Link>
            <div className="hero-rise flex items-center gap-3 mb-5" style={{ "--rise": "60ms" } as CSSProperties}>
              <span className="font-spec text-[10px] tracking-widest" style={{ color: "var(--accent-light)" }}>{article.type}</span>
              <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{article.topic}</span>
            </div>
            <h1 className="hero-rise text-3xl sm:text-4xl font-bold leading-tight mb-4" style={{ "--rise": "120ms" } as CSSProperties}>{article.title}</h1>
            <p className="hero-rise text-lg leading-relaxed mb-6" style={{ color: "var(--text-muted)", "--rise": "200ms" } as CSSProperties}>{article.subtitle}</p>
            <p className="hero-rise font-spec text-xs" style={{ color: "var(--text-faint)", "--rise": "280ms" } as CSSProperties}>{formatDate(article.date)} · {article.readTime}</p>
          </div>
        </header>

        {/* Cover image */}
        {article.coverImage && (
          <div style={{ background: "var(--bg-surface)" }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.coverImage} alt={article.title} className="w-full h-auto rounded-lg" style={{ border: "1px solid var(--border-accent)" }} />
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ background: "var(--bg-surface)" }}>
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
            <div className="article-body">
              <DocumentRenderer document={article.body} />
            </div>

            <Reveal variant="scale-in">
              <div className="accent-banner card card-glow p-7 mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div>
                  <h2 className="text-lg font-bold mb-1">Have a project like this?</h2>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Tell me what you make and who you sell to.</p>
                </div>
                <Link href="/start" className="btn-primary flex-shrink-0">Start a Project</Link>
              </div>
            </Reveal>
          </div>
        </div>

        {/* More */}
        {more.length > 0 && (
          <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
              <Reveal>
                <h2 className="text-xl font-bold mb-6">Keep reading</h2>
              </Reveal>
              <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-5" step={90}>
                {more.map((a) => (
                  <Link key={a.slug} href={`/articles/${a.slug}`} className="card card-glow p-6 no-underline group">
                    <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{a.topic}</span>
                    <h3 className="text-sm font-semibold leading-snug mt-2 group-hover:underline" style={{ color: "var(--text-heading)" }}>{a.title}</h3>
                  </Link>
                ))}
              </Stagger>
            </div>
          </section>
        )}
      </article>
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle, articlesByDate } from "@/data/articles";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
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
  const article = getArticle(slug);
  if (!article) notFound();

  const more = articlesByDate().filter((a) => a.slug !== article.slug).slice(0, 2);

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
            <Link href="/articles" className="font-spec text-xs mb-6 inline-block" style={{ color: "var(--accent-light)" }}>← All articles</Link>
            <div className="flex items-center gap-3 mb-5">
              <span className="badge">{article.type}</span>
              <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{article.topic}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">{article.title}</h1>
            <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>{article.subtitle}</p>
            <p className="font-spec text-xs" style={{ color: "var(--text-faint)" }}>{formatDate(article.date)} · {article.readTime}</p>
          </div>
        </header>

        {/* Body */}
        <div style={{ background: "var(--bg-surface)" }}>
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
            <div className="article-body" dangerouslySetInnerHTML={{ __html: article.body }} />

            <div className="accent-banner card p-7 mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Have a project like this?</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Tell me what you make and who you sell to.</p>
              </div>
              <Link href="/start" className="btn-primary flex-shrink-0">Start a Project</Link>
            </div>
          </div>
        </div>

        {/* More */}
        {more.length > 0 && (
          <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
              <h2 className="text-xl font-bold mb-6">Keep reading</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {more.map((a) => (
                  <Link key={a.slug} href={`/articles/${a.slug}`} className="card p-6 no-underline group">
                    <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{a.topic}</span>
                    <h3 className="text-sm font-semibold leading-snug mt-2 group-hover:underline" style={{ color: "var(--text-heading)" }}>{a.title}</h3>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
    </>
  );
}

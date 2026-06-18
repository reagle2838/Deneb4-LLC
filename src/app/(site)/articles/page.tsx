import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import { getAllArticles } from "@/lib/content";

export const metadata: Metadata = {
  title: "Articles & Insights",
  description:
    "Plain-spoken articles on building websites for technical businesses: strategy, AI discoverability (AIO), ownership, process, and case studies.",
  alternates: { canonical: "https://deneb4.com/articles" },
};

export default async function ArticlesPage() {
  const articles = await getAllArticles();

  return (
    <>
      <PageHero
        eyebrow="Articles & Insights"
        title="Notes on building sites that pull their weight."
        subtitle="Strategy, AI discoverability, ownership, and the occasional case study. Written for people who make technical things."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((a) => (
              <Link key={a.slug} href={`/articles/${a.slug}`} className="card flex flex-col no-underline group overflow-hidden">
                <div className="relative h-36 flex-shrink-0 bg-grid flex items-end p-4 overflow-hidden" style={{ borderBottom: "1px solid var(--border-accent)" }}>
                  {a.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.coverImage} alt={a.title} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <span className="font-spec text-[10px] tracking-widest relative z-10 px-1.5 py-0.5 rounded-sm" style={{ color: "var(--accent-light)", background: a.coverImage ? "var(--bg-surface)" : "transparent" }}>{a.type}</span>
                </div>
                <div className="p-6 flex flex-col gap-2 flex-1">
                  <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{a.topic} · {a.readTime}</span>
                  <h2 className="text-base font-semibold leading-snug group-hover:underline" style={{ color: "var(--text-heading)" }}>{a.title}</h2>
                  <p className="text-xs leading-relaxed flex-1" style={{ color: "var(--text-muted)" }}>{a.subtitle}</p>
                  <span className="font-spec text-xs mt-2" style={{ color: "var(--accent-light)" }}>Read →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

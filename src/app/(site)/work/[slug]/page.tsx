import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentRenderer } from "@keystatic/core/renderer";
import { getAllProjects, getAllProjectSlugs, getProjectBySlug } from "@/lib/work";
import WorkGallery from "./WorkGallery";

export async function generateStaticParams() {
  const slugs = await getAllProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return { title: "Project not found" };
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: `https://deneb4.com/work/${project.slug}` },
    openGraph: { title: project.title, description: project.summary, type: "article" },
  };
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

export default async function WorkProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const allProjects = await getAllProjects();
  const more = allProjects.filter((p) => p.slug !== project.slug);

  return (
    <>
      <article>
        {/* Header */}
        <header className="bg-grid" style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-accent)" }}>
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <Link href="/work" className="font-spec text-xs mb-6 inline-block" style={{ color: "var(--accent-light)" }}>← All work</Link>
            <div className="flex items-center gap-3 mb-5">
              <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{project.sector}</span>
              <span className="font-spec text-[10px] tracking-widest px-2 py-0.5 rounded-sm" style={{ background: "var(--bg-alt)", border: "1px solid var(--border-accent)", color: project.status === "live" ? "var(--accent-light)" : "var(--text-faint)" }}>
                {project.status === "live" ? "LIVE" : "IN PROGRESS"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">{project.title}</h1>
            <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>{project.summary}</p>
            <div className="flex flex-wrap items-center gap-4">
              {project.date && (
                <p className="font-spec text-xs" style={{ color: "var(--text-faint)" }}>{formatDate(project.date)}</p>
              )}
              {project.liveUrl && (
                <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="font-spec text-xs" style={{ color: "var(--accent-light)" }}>
                  Visit site →
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Cover image */}
        {project.coverImage && (
          <div style={{ background: "var(--bg-surface)" }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={project.coverImage} alt={project.title} className="w-full h-auto rounded-lg" style={{ border: "1px solid var(--border-accent)" }} />
            </div>
          </div>
        )}

        {/* Tech tags */}
        {project.tags.length > 0 && (
          <div style={{ background: "var(--bg-alt)", borderBottom: "1px solid var(--border-accent)" }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-spec" style={{ color: "var(--text-faint)" }}>
                {project.tags.map((t, i) => (
                  <span key={t}>{i > 0 && <span className="mr-4">·</span>}{t}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ background: "var(--bg-surface)" }}>
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
            <div className="article-body">
              <DocumentRenderer document={project.body} />
            </div>

            <WorkGallery images={project.gallery} title={project.title} />

            <div className="accent-banner card p-7 mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Have a project like this?</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Tell me what you make and who you sell to.</p>
              </div>
              <Link href="/start" className="btn-primary flex-shrink-0">Start a Project</Link>
            </div>
          </div>
        </div>

        {/* More work */}
        {more.length > 0 && (
          <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
              <h2 className="text-xl font-bold mb-6">More work</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {more.map((p) => (
                  <Link key={p.slug} href={`/work/${p.slug}`} className="card p-6 no-underline group">
                    <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{p.sector}</span>
                    <h3 className="text-sm font-semibold leading-snug mt-2 group-hover:underline" style={{ color: "var(--text-heading)" }}>{p.title}</h3>
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

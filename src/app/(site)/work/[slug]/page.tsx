import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { DocumentRenderer } from "@keystatic/core/renderer";
import Reveal from "@/components/motion/Reveal";
import Stagger from "@/components/motion/Stagger";
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
            <Link href="/work" className="hero-rise font-spec text-xs mb-6 inline-block" style={{ color: "var(--accent-light)" }}>← All work</Link>
            <div className="hero-rise flex items-center gap-3 mb-5" style={{ "--rise": "60ms" } as CSSProperties}>
              <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
                {project.sector} · <span style={{ color: project.status === "live" ? "var(--accent-light)" : "var(--text-faint)" }}>{project.status === "live" ? "Live" : "In progress"}</span>
              </span>
            </div>
            <h1 className="hero-rise text-3xl sm:text-4xl font-bold leading-tight mb-4" style={{ "--rise": "120ms" } as CSSProperties}>{project.title}</h1>
            <p className="hero-rise text-lg leading-relaxed mb-6" style={{ color: "var(--text-muted)", "--rise": "200ms" } as CSSProperties}>{project.summary}</p>
            <div className="hero-rise flex flex-wrap items-center gap-4" style={{ "--rise": "280ms" } as CSSProperties}>
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

        {/* More work */}
        {more.length > 0 && (
          <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
              <Reveal>
                <h2 className="text-xl font-bold mb-6">More work</h2>
              </Reveal>
              <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-5" step={90}>
                {more.map((p) => (
                  <Link key={p.slug} href={`/work/${p.slug}`} className="card card-glow p-6 no-underline group">
                    <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{p.sector}</span>
                    <h3 className="text-sm font-semibold leading-snug mt-2 group-hover:underline" style={{ color: "var(--text-heading)" }}>{p.title}</h3>
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

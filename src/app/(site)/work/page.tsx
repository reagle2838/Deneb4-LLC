import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import { getAllProjects } from "@/lib/work";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Selected work by Deneb4: websites built as owned infrastructure for industrial, engineering, and manufacturing businesses.",
  alternates: { canonical: "https://deneb4.com/work" },
};

export default async function WorkPage() {
  const projects = await getAllProjects();

  return (
    <>
      <PageHero
        eyebrow="Selected work"
        title="Sites built to carry real weight."
        subtitle="A focused studio takes a small number of projects at a time. Here's the kind of work that comes out of it."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24 space-y-8">
          {projects.map((p) => {
            const inner = (
              <>
                <div className="relative h-44 bg-grid flex items-center justify-center flex-shrink-0" style={{ borderBottom: "1px solid var(--border-accent)" }}>
                  <span className="font-spec text-sm tracking-widest" style={{ color: "var(--accent-light)" }}>{p.title}</span>
                  <span className="absolute top-3 left-3 font-spec text-[10px] tracking-widest px-2 py-0.5 rounded-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-accent)", color: p.status === "live" ? "var(--accent-light)" : "var(--text-faint)" }}>
                    {p.status === "live" ? "LIVE" : "IN PROGRESS"}
                  </span>
                </div>
                <div className="p-8">
                  <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{p.sector}</span>
                  <h2 className="text-2xl font-bold mt-2 mb-3" style={{ color: "var(--text-heading)" }}>{p.title}</h2>
                  <p className="text-base leading-relaxed mb-5" style={{ color: "var(--text-muted)" }}>{p.summary}</p>
                  <div className="flex flex-wrap gap-2 text-xs font-spec" style={{ color: "var(--text-faint)" }}>
                    {p.tags.map((t, i) => (
                      <span key={t}>{i > 0 && <span className="mr-2">·</span>}{t}</span>
                    ))}
                  </div>
                  {p.body && <p className="mt-5 font-spec text-xs" style={{ color: "var(--accent-light)" }}>Read the case study →</p>}
                </div>
              </>
            );

            return p.body ? (
              <Link key={p.slug} href={`/work/${p.slug}`} className="card overflow-hidden no-underline block" style={{ padding: 0 }}>
                {inner}
              </Link>
            ) : (
              <div key={p.slug} className="card overflow-hidden" style={{ padding: 0 }}>
                {inner}
              </div>
            );
          })}

          {/* Placeholder card if no projects yet */}
          {projects.length === 0 && (
            <div className="card overflow-hidden" style={{ padding: 0 }}>
              <div className="relative h-44 bg-grid flex items-center justify-center" style={{ borderBottom: "1px solid var(--border-accent)" }}>
                <span className="font-spec text-sm tracking-widest" style={{ color: "var(--text-faint)" }}>Your project here</span>
              </div>
              <div className="p-8">
                <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>Manufacturing · Automation · Fabrication</span>
                <h2 className="text-2xl font-bold mt-2 mb-3" style={{ color: "var(--text-heading)" }}>Your project here</h2>
                <p className="text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Deneb4 is a focused studio taking a small number of projects at a time. The next case study could be yours.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Want to be the next one?</h2>
          <Link href="/start" className="btn-primary mt-4">Start a Project</Link>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Selected work by Deneb4 — websites built as owned infrastructure for industrial, engineering, and manufacturing businesses.",
  alternates: { canonical: "https://deneb4.com/work" },
};

interface Project {
  name: string;
  sector: string;
  summary: string;
  tags: string[];
  href?: string;
  status?: "live" | "in-progress";
}

const PROJECTS: Project[] = [
  {
    name: "Eagle Engineering & Supply Co.",
    sector: "Industrial Engineering · Distribution",
    summary:
      "A 55-year-old multi-division firm — electrical control design, proprietary material handling equipment, authorized power distribution, and industrial technology — rebuilt as owned infrastructure. Full-screen mega menu, blueprint design system, equipment catalog, and a careers portal with resume upload.",
    tags: ["Next.js", "Mega menu", "Catalog", "Careers"],
    href: "/articles/eagle-engineering-55-year-firm-rebuilt",
    status: "live",
  },
  {
    name: "Your project here",
    sector: "Manufacturing · Automation · Fabrication",
    summary:
      "Deneb4 is a focused studio taking a small number of projects at a time. The next case study could be yours — a site scoped to your buyers, your specs, and your sales process.",
    tags: ["Foundation", "Professional", "Enterprise"],
    status: "in-progress",
  },
];

export default function WorkPage() {
  return (
    <>
      <PageHero
        eyebrow="Selected work"
        title="Sites built to carry real weight."
        subtitle="A focused studio takes a small number of projects at a time. Here's the kind of work that comes out of it."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24 space-y-8">
          {PROJECTS.map((p) => {
            const inner = (
              <>
                <div className="relative h-44 bg-grid flex items-center justify-center flex-shrink-0" style={{ borderBottom: "1px solid var(--border-accent)" }}>
                  <span className="font-spec text-sm tracking-widest" style={{ color: "var(--accent-light)" }}>{p.name}</span>
                  <span className="absolute top-3 left-3 font-spec text-[10px] tracking-widest px-2 py-0.5 rounded-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-accent)", color: p.status === "live" ? "var(--accent-light)" : "var(--text-faint)" }}>
                    {p.status === "live" ? "LIVE" : "AVAILABLE"}
                  </span>
                </div>
                <div className="p-8">
                  <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{p.sector}</span>
                  <h2 className="text-2xl font-bold mt-2 mb-3" style={{ color: "var(--text-heading)" }}>{p.name}</h2>
                  <p className="text-base leading-relaxed mb-5" style={{ color: "var(--text-muted)" }}>{p.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.tags.map((t) => <span key={t} className="spec-tag">{t}</span>)}
                  </div>
                  {p.href && <p className="mt-5 font-spec text-xs" style={{ color: "var(--accent-light)" }}>Read the case study →</p>}
                </div>
              </>
            );
            return p.href ? (
              <Link key={p.name} href={p.href} className="card overflow-hidden no-underline block" style={{ padding: 0 }}>{inner}</Link>
            ) : (
              <div key={p.name} className="card overflow-hidden" style={{ padding: 0 }}>{inner}</div>
            );
          })}
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

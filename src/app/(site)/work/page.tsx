import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import CtaBanner from "@/components/ui/CtaBanner";
import Reveal from "@/components/motion/Reveal";
import Stagger from "@/components/motion/Stagger";
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
        title={<>Built for buyers who <span style={{ color: "var(--accent-light)" }}>read the spec sheet first.</span></>}
        subtitle="Proof, not promises. A focused studio takes a small number of projects at a time, and this is the kind of work that comes out of it."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24">
          <Stagger className="space-y-8" step={140}>
            {projects.map((p) => (
              <Link key={p.slug} href={`/work/${p.slug}`} className="card card-glow card-tilt overflow-hidden no-underline block" style={{ padding: 0 }}>
                <div className="relative h-56 bg-grid flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ borderBottom: "1px solid var(--border-accent)" }}>
                  {p.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverImage} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span className="font-spec text-sm tracking-widest" style={{ color: "var(--accent-light)" }}>{p.title}</span>
                  )}
                </div>
                <div className="p-8">
                  <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
                    {p.sector} · <span style={{ color: p.status === "live" ? "var(--accent-light)" : "var(--text-faint)" }}>{p.status === "live" ? "Live" : "In progress"}</span>
                  </span>
                  <h2 className="text-2xl font-bold mt-2 mb-3" style={{ color: "var(--text-heading)" }}>{p.title}</h2>
                  <p className="text-base leading-relaxed mb-5" style={{ color: "var(--text-muted)" }}>{p.summary}</p>
                  <div className="flex flex-wrap gap-2 text-xs font-spec" style={{ color: "var(--text-faint)" }}>
                    {p.tags.map((t, i) => (
                      <span key={t}>{i > 0 && <span className="mr-2">·</span>}{t}</span>
                    ))}
                  </div>
                  <p className="mt-5 font-spec text-xs" style={{ color: "var(--accent-light)" }}>Read the case study →</p>
                </div>
              </Link>
            ))}

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
          </Stagger>
        </div>
      </section>

      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <Reveal variant="scale-in">
            <CtaBanner
              variant="centered"
              title={<>Want to be <span style={{ color: "var(--accent-light)" }}>the next one?</span></>}
              body="Tell me what you make and who buys it. The next case study on this page could be your shop."
              primary={{ href: "/start", label: "Start a Project" }}
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}

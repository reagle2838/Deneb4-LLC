import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import { PHASES } from "@/data/process";

export const metadata: Metadata = {
  title: "Process",
  description:
    "Deneb4's transparent four-phase process: Discovery & Brief, Design, Development, and QA & Launch. No vague timelines, no black-box delivery — each phase needs your sign-off before the next begins.",
  alternates: { canonical: "https://deneb4.com/process" },
};

export default function ProcessPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="A transparent, four-phase process."
        subtitle="No vague timelines. No black-box delivery. You review and approve each layer before the next one starts — which is exactly what keeps a fixed-price project fixed."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="space-y-6">
            {PHASES.map((phase, i) => (
              <div key={phase.n} className="card p-8 lg:p-10 flex flex-col lg:flex-row gap-8" style={i === 0 ? { borderColor: "var(--accent)" } : undefined}>
                <div className="lg:w-48 flex-shrink-0">
                  <span className="font-spec text-4xl font-bold" style={{ color: "var(--accent-light)" }}>{phase.n}</span>
                  <p className="spec-tag inline-flex mt-3">{phase.weeks}</p>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text-heading)" }}>{phase.title}</h2>
                  <p className="text-base leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>{phase.summary}</p>
                  <p className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--text-faint)" }}>Deliverables</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {phase.deliverables.map((d) => (
                      <div key={d} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                        <span style={{ color: "var(--accent)" }} className="mt-1.5 text-[8px] flex-shrink-0">●</span>{d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to define your brief?</h2>
          <p className="text-base max-w-xl mx-auto mb-8" style={{ color: "var(--text-muted)" }}>
            Phase one starts with a simple intake form. Fill it out and we&apos;ll turn it into a clear, scoped plan.
          </p>
          <Link href="/start" className="btn-primary">Start a Project</Link>
        </div>
      </section>
    </>
  );
}

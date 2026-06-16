import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import { INDUSTRIES } from "@/data/industries";

export const metadata: Metadata = {
  title: "Industries",
  description:
    "Deneb4 builds websites for industrial and mechanical engineering, manufacturing, automation & controls, fabrication, technical distribution, equipment specialists, and more — technically sophisticated, quote-driven businesses.",
  alternates: { canonical: "https://deneb4.com/industries" },
};

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Who it's for"
        title="Built for businesses that make things."
        subtitle="Deneb4 works with technically sophisticated, B2B, quote-driven companies — usually 10 to 250 people. Industry literacy means no learning curve and no generic marketing fluff."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {INDUSTRIES.map((ind) => (
              <div key={ind.slug} id={ind.slug} className="card p-8 flex flex-col gap-3 scroll-mt-28">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold" style={{ color: "var(--text-heading)" }}>{ind.label}</h2>
                  <span className="font-spec text-[10px] tracking-widest flex-shrink-0" style={{ color: "var(--accent-light)" }}>{ind.spec}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{ind.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Don&apos;t see your exact field?</h2>
          <p className="text-base max-w-xl mx-auto mb-8" style={{ color: "var(--text-muted)" }}>
            If you sell something technical to careful buyers, you&apos;re in the right place. Tell me what you make.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/start" className="btn-primary">Start a Project</Link>
            <Link href="/work" className="btn-outline">See the Work</Link>
          </div>
        </div>
      </section>
    </>
  );
}

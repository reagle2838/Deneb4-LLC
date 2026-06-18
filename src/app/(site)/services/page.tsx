import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import { CAPABILITY_GROUPS, ADD_ONS, OWNERSHIP_POINTS } from "@/data/services";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Web design and development for technical businesses: websites and content systems, sales and operations systems, and sales collateral and print materials. Fixed-scope, fixed-price, and you own it.",
  alternates: { canonical: "https://deneb4.com/services" },
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services & Pricing"
        title="Priced by scope, not by the hour."
        subtitle="Every package is a complete, custom build, designed, developed, and handed over as an asset you own outright. No retainers, no lock-in."
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/start" className="btn-primary">Start a Project</Link>
          <Link href="/process" className="btn-outline">See the Process</Link>
        </div>
      </PageHero>

      {/* Web Design & Development */}
      <section id="packages" style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="mb-14 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Web Design &amp; Development</h2>
            <p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
              One offering, scoped to what you actually need. Mix and match across three areas: the website and content systems behind it, the systems that run your sales and operations, and the printed materials that carry the brand offline.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {CAPABILITY_GROUPS.map((g) => (
              <div key={g.id} id={g.id} className="card p-8 flex flex-col gap-5 scroll-mt-28">
                <div>
                  <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>{g.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{g.tagline}</p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {g.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                      <span style={{ color: "var(--accent)" }} className="mt-1.5 text-[8px] flex-shrink-0">●</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-sm mt-8 max-w-3xl" style={{ color: "var(--text-faint)" }}>
            Not sure what you need? Send a brief and you&apos;ll get a scoped recommendation, not a sales pitch.
          </p>
        </div>
      </section>

      {/* Add-ons + ownership */}
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-8">Add-ons</h2>
            <div style={{ borderTop: "1px solid var(--border-accent)" }}>
              {ADD_ONS.map((a) => (
                <div key={a.label} className="flex items-center justify-between py-4" style={{ borderBottom: "1px solid var(--border-accent)" }}>
                  <span className="text-sm" style={{ color: "var(--text-heading)" }}>{a.label}</span>
                  <span className="font-spec text-sm" style={{ color: "var(--accent-light)" }}>{a.price}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-8">What you own</h2>
            <div className="accent-banner card p-7">
              <ul className="space-y-4">
                {OWNERSHIP_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm" style={{ color: "var(--text-muted)" }}>
                    <span style={{ color: "var(--accent)" }} className="mt-1 text-[10px] flex-shrink-0">◆</span>{point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Not sure where to start?</h2>
          <p className="text-base max-w-xl mx-auto mb-8" style={{ color: "var(--text-muted)" }}>
            Describe what you need in the project brief and you&apos;ll get a scoped, fixed-price proposal back, usually within a day or two.
          </p>
          <Link href="/start" className="btn-primary">Start a Project</Link>
        </div>
      </section>
    </>
  );
}

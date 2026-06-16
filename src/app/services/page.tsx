import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import { PACKAGES, FUNCTIONAL_TOOLS, ADD_ONS, OWNERSHIP_POINTS } from "@/data/services";

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "Fixed-scope, fixed-price website packages for technical businesses: Foundation ($4,500), Professional ($6,000), and Enterprise ($8,000). Plus custom functional tools — catalogs, quote forms, CMS, and more.",
  alternates: { canonical: "https://deneb4.com/services" },
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services & Pricing"
        title="Priced by scope, not by the hour."
        subtitle="Every package is a complete, custom build — designed, developed, and handed over as an asset you own outright. No retainers, no lock-in."
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/start" className="btn-primary">Start a Project</Link>
          <Link href="/process" className="btn-outline">See the Process</Link>
        </div>
      </PageHero>

      {/* Packages */}
      <section id="packages" style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {PACKAGES.map((p) => (
              <div key={p.id} className="card p-8 flex flex-col gap-5" style={p.featured ? { borderColor: "var(--accent)", boxShadow: "0 4px 24px rgba(0,107,143,0.16)" } : undefined}>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold" style={{ color: "var(--text-heading)" }}>{p.name}</h2>
                  {p.featured && <span className="badge">Most popular</span>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold" style={{ color: "var(--accent-light)" }}>{p.price}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{p.tagline}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="spec-tag">{p.pages}</span>
                  <span className="spec-tag">{p.revisions}</span>
                  <span className="spec-tag">{p.delivery}</span>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                      <span style={{ color: "var(--accent)" }} className="mt-1.5 text-[8px] flex-shrink-0">●</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/start" className={`${p.featured ? "btn-primary" : "btn-outline"} justify-center text-sm`}>Start with {p.name}</Link>
              </div>
            ))}
          </div>
          <p className="text-sm mt-8 max-w-3xl" style={{ color: "var(--text-faint)" }}>
            Tool credits apply toward any functional tools below. Unsure which tier fits? Send a brief and you&apos;ll get a recommendation, not a sales pitch.
          </p>
        </div>
      </section>

      {/* Functional tools */}
      <section id="tools" style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="mb-14 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Functional tools</h2>
            <p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
              The features that turn a brochure into working infrastructure. Add any to a package — your tool credits go toward these first.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FUNCTIONAL_TOOLS.map((t) => (
              <div key={t.label} className="card p-6 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-heading)" }}>{t.label}</h3>
                  <span className="font-spec text-xs flex-shrink-0" style={{ color: "var(--accent-light)" }}>{t.price}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{t.desc}</p>
              </div>
            ))}
          </div>
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
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Not sure which package fits?</h2>
          <p className="text-base max-w-xl mx-auto mb-8" style={{ color: "var(--text-muted)" }}>
            Describe what you need in the project brief and you&apos;ll get a scoped, fixed-price proposal back — usually within a day or two.
          </p>
          <Link href="/start" className="btn-primary">Start a Project</Link>
        </div>
      </section>
    </>
  );
}

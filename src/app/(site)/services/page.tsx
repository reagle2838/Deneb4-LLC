import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import CtaBanner from "@/components/ui/CtaBanner";
import SectionEyebrow from "@/components/ui/SectionEyebrow";
import Reveal from "@/components/motion/Reveal";
import Stagger from "@/components/motion/Stagger";
import { ADD_ONS, OWNERSHIP_POINTS } from "@/data/services";
import { getCapabilityGroups } from "@/lib/services-content";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Web design and development for technical businesses: websites and content systems, sales and operations systems, and sales collateral and print materials. Fixed-scope, fixed-price, and you own it.",
  alternates: { canonical: "https://deneb4.com/services" },
};

export default async function ServicesPage() {
  const groups = await getCapabilityGroups();
  return (
    <>
      <PageHero
        eyebrow="Services & Pricing"
        title={<>You know the price <span style={{ color: "var(--accent-light)" }}>before the work starts.</span></>}
        subtitle="Every package is a complete, custom build: designed, developed, and handed over as an asset you own outright. No hourly meters, no retainers, no lock-in."
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/start" className="btn-primary">Start a Project</Link>
          <Link href="/process" className="btn-outline">See the Process</Link>
        </div>
      </PageHero>

      {/* Web Design & Development */}
      <section id="packages" style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <Reveal className="mb-14 max-w-2xl">
            <SectionEyebrow index="01" label="What you can build" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Scoped around <span style={{ color: "var(--accent-light)" }}>your catalog, your quoting, your buyers</span></h2>
            <p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
              One offering, scoped to what you actually need. Mix and match across three areas: the website and content systems behind it, the systems that run your sales and operations, and the printed materials that carry the brand offline.
            </p>
          </Reveal>
          <Stagger className="grid grid-cols-1 lg:grid-cols-3 gap-6" step={110}>
            {groups.map((g) => (
              <div key={g.id} id={g.id} className="card card-glow p-8 flex flex-col gap-5 scroll-mt-28">
                <div>
                  <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>{g.title}</h3>
                  <p className="text-sm font-semibold leading-relaxed" style={{ color: "var(--accent)" }}>{g.tagline}</p>
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
          </Stagger>
          <Reveal variant="fade">
            <p className="text-sm mt-8 max-w-3xl" style={{ color: "var(--text-faint)" }}>
              Not sure what you need? Send a brief and you&apos;ll get a scoped recommendation, not a sales pitch.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Deployment & secured infrastructure (Eagle partnership) */}
      <section id="deployment" style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <Reveal variant="fade-left">
              <p className="font-spec text-xs tracking-widest uppercase mb-3" style={{ color: "var(--accent-light)" }}>Deployment &amp; Secured Infrastructure</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Your software, built here. <span style={{ color: "var(--accent-light)" }}>Secured and deployed</span> by our partner.
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
                If your operations platform needs to run on secured, on-site infrastructure, we partner directly with Eagle Technology Solutions. Their team handles the complete deployment and provisioning of the on-site hardware while we handle the software, so you get one turnkey, secured system without coordinating between separate tech vendors.
              </p>
              <Link href="/work/eagle-engineering" className="btn-outline text-sm mt-6 inline-flex">See the Eagle Engineering build →</Link>
            </Reveal>
            <Reveal variant="fade-right" delay={120}>
              <div className="card card-glow p-7">
                <ul className="space-y-4">
                  {[
                    "Deployment and provisioning by Eagle's team",
                    "SonicWall firewalls and network hardening",
                    "ViewSonic commercial displays",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm" style={{ color: "var(--text-muted)" }}>
                      <span style={{ color: "var(--accent)" }} className="mt-1 text-[10px] flex-shrink-0">◆</span>{point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Add-ons + ownership */}
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold mb-8">Add-ons</h2>
            <Stagger variant="fade" step={60} style={{ borderTop: "1px solid var(--border-accent)" }}>
              {ADD_ONS.map((a) => (
                <div key={a.label} className="flex items-center justify-between py-4" style={{ borderBottom: "1px solid var(--border-accent)" }}>
                  <span className="text-sm" style={{ color: "var(--text-heading)" }}>{a.label}</span>
                  <span className="font-spec text-sm" style={{ color: "var(--accent-light)" }}>{a.price}</span>
                </div>
              ))}
            </Stagger>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-8">What <span style={{ color: "var(--accent-light)" }}>you own</span></h2>
            <div className="accent-banner card card-glow p-7">
              <ul className="space-y-4">
                {OWNERSHIP_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm" style={{ color: "var(--text-muted)" }}>
                    <span style={{ color: "var(--accent)" }} className="mt-1 text-[10px] flex-shrink-0">◆</span>{point}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs mt-4" style={{ color: "var(--text-faint)" }}>
              *Monthly retainers are available if you&apos;d like ongoing support. They&apos;re optional, never required.
            </p>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <Reveal variant="scale-in">
            <CtaBanner
              variant="centered"
              title={<>Not sure <span style={{ color: "var(--accent-light)" }}>where to start?</span></>}
              body="Describe what you need in the project brief and you'll get a scoped, fixed-price proposal back, usually within a day or two."
              primary={{ href: "/start", label: "Start a Project" }}
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import CtaBanner from "@/components/ui/CtaBanner";
import Stagger from "@/components/motion/Stagger";
import Reveal from "@/components/motion/Reveal";
import { INDUSTRIES } from "@/data/industries";

export const metadata: Metadata = {
  title: "Industries",
  description:
    "Deneb4 builds websites for industrial and mechanical engineering, manufacturing, automation and controls, fabrication, technical distribution, equipment specialists, and more: technically sophisticated, quote-driven businesses.",
  alternates: { canonical: "https://deneb4.com/industries" },
};

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Who it's for"
        title={<>Built for businesses that <span style={{ color: "var(--accent-light)" }}>make things.</span></>}
        subtitle="If your buyers ask about tolerances, certifications, and lead times before they ever call, you are in the right place. No learning curve, no generic marketing fluff."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <Stagger className="grid grid-cols-1 lg:grid-cols-2 gap-6" step={80}>
            {INDUSTRIES.map((ind) => (
              <div key={ind.slug} id={ind.slug} className="card card-glow p-8 flex flex-col gap-3 scroll-mt-28">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--text-heading)" }}>{ind.label}</h2>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{ind.blurb}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <Reveal variant="scale-in">
            <CtaBanner
              variant="centered"
              title={<>Don&apos;t see <span style={{ color: "var(--accent-light)" }}>your exact field?</span></>}
              body="If you sell something technical to careful buyers, you're in the right place. Tell me what you make."
              primary={{ href: "/start", label: "Start a Project" }}
              secondary={{ href: "/work", label: "See the Work" }}
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}

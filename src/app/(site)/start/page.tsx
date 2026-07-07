import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Reveal from "@/components/motion/Reveal";
import Stagger from "@/components/motion/Stagger";
import ProjectForm, { DISCOVERY_CALL_URL } from "./ProjectForm";
import { getCapabilityGroups } from "@/lib/services-content";

export const metadata: Metadata = {
  title: "Start a Project",
  description:
    "Start your website project with Deneb4. Share a quick brief about your business, scope, and timeline, and get a scoped, fixed-price proposal back, usually within a day or two.",
  alternates: { canonical: "https://deneb4.com/start" },
};

const STEPS = [
  { n: "01", t: "You send the brief", d: "The form below: five minutes. The more detail, the faster the turnaround." },
  { n: "02", t: "It comes back scoped", d: "You get a fixed-price proposal and a clear plan, not a discovery-call funnel." },
  { n: "03", t: "You approve, we build", d: "The four-phase process kicks off, with your sign-off at every step." },
];

export default async function StartPage() {
  const groups = await getCapabilityGroups();
  return (
    <section className="bg-grid" style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Left: copy + steps */}
          <div className="lg:col-span-2">
            <p className="hero-rise text-xs font-semibold tracking-[0.2em] uppercase mb-5" style={{ color: "var(--accent-light)" }}>Start a Project</p>
            <h1 className="hero-rise text-4xl sm:text-5xl font-bold leading-tight mb-5" style={{ "--rise": "90ms" } as CSSProperties}>
              Tell me <span style={{ color: "var(--accent-light)" }}>what you make.</span>
            </h1>
            <p className="hero-rise text-lg leading-relaxed mb-10" style={{ color: "var(--text-muted)", "--rise": "180ms" } as CSSProperties}>
              Five minutes of detail about your business gets you a scoped, fixed-price plan back. No obligation, no sales calls, no pressure.
            </p>
            <Stagger className="space-y-6" step={120} delay={260}>
              {STEPS.map((s) => (
                <div key={s.n} className="flex gap-4">
                  <span className="font-spec text-xl font-bold flex-shrink-0" style={{ color: "var(--accent-light)" }}>{s.n}</span>
                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--text-heading)" }}>{s.t}</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.d}</p>
                  </div>
                </div>
              ))}
            </Stagger>
            <p className="font-spec text-xs mt-10" style={{ color: "var(--text-faint)" }}>
              Prefer email? hello@deneb4.com · Mon-Fri 9am-5pm EST
            </p>
            <p className="font-spec text-xs mt-2" style={{ color: "var(--text-faint)" }}>
              Prefer to talk it through?{" "}
              <a href={DISCOVERY_CALL_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-light)" }}>
                Book a discovery call →
              </a>
            </p>
          </div>

          {/* Right: form */}
          <Reveal variant="fade-right" delay={150} eager className="lg:col-span-3">
            <ProjectForm groups={groups} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import PhaseStack from "./PhaseStack";

export const metadata: Metadata = {
  title: "Process",
  description:
    "Deneb4's transparent four-phase process: Discovery and Brief, Design, Development, and QA and Launch. No vague timelines, no black-box delivery: each phase needs your sign-off before the next begins.",
  alternates: { canonical: "https://deneb4.com/process" },
};

export default function ProcessPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="A transparent, four-phase process."
        subtitle="No vague timelines. No black-box delivery. You review and approve each layer before the next one starts: that's what keeps a fixed-price project fixed."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24">
          <PhaseStack />
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

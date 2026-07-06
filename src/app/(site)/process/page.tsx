import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import CtaBanner from "@/components/ui/CtaBanner";
import Reveal from "@/components/motion/Reveal";
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
        title={<>You see every step. <span style={{ color: "var(--accent-light)" }}>You approve every phase.</span></>}
        subtitle="No vague timelines. No black-box delivery. You review and approve each layer before the next one starts: that's what keeps a fixed-price project fixed."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24">
          <Reveal variant="fade">
            <PhaseStack />
          </Reveal>
        </div>
      </section>

      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <Reveal variant="scale-in">
            <CtaBanner
              variant="centered"
              title={<>Ready to define <span style={{ color: "var(--accent-light)" }}>your brief?</span></>}
              body="Phase one starts with a simple intake form. Fill it out and it comes back to you as a clear, scoped plan."
              primary={{ href: "/start", label: "Start a Project" }}
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}

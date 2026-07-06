import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import CtaBanner from "@/components/ui/CtaBanner";
import Reveal from "@/components/motion/Reveal";
import FaqAccordion from "@/components/ui/FaqAccordion";
import { FAQS } from "@/data/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Common questions about working with Deneb4: pricing, timelines, content, ownership, technology, revisions, and what happens after launch.",
  alternates: { canonical: "https://deneb4.com/faq" },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <PageHero
        eyebrow="FAQ"
        title={<>Straight <span style={{ color: "var(--accent-light)" }}>answers.</span></>}
        subtitle="The questions clients ask most. If yours isn't here, just send a message: you'll get a real reply."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
          <Reveal variant="fade">
            <FaqAccordion faqs={FAQS} />
          </Reveal>
        </div>
      </section>

      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <Reveal variant="scale-in">
            <CtaBanner
              variant="centered"
              title={<>Still have <span style={{ color: "var(--accent-light)" }}>a question?</span></>}
              body="Ask anything about your project. Real questions get real replies, not a drip campaign."
              primary={{ href: "/contact", label: "Ask a question" }}
              secondary={{ href: "/start", label: "Start a Project" }}
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}

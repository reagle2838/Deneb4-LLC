import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
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
        title="Straight answers."
        subtitle="The questions clients ask most. If yours isn't here, just send a message: you'll get a real reply."
      />

      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
          <FaqAccordion faqs={FAQS} />
        </div>
      </section>

      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Still have a question?</h2>
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <Link href="/contact" className="btn-primary">Ask a question</Link>
            <Link href="/start" className="btn-outline">Start a Project</Link>
          </div>
        </div>
      </section>
    </>
  );
}

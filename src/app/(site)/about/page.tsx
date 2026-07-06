import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import CtaBanner from "@/components/ui/CtaBanner";
import Reveal from "@/components/motion/Reveal";
import Stagger from "@/components/motion/Stagger";

export const metadata: Metadata = {
  title: "About",
  description:
    "Deneb4 was founded by Ridhi: a computer science background combined with hands-on exposure to industrial engineering and custom fabrication. One person, end to end, building websites as infrastructure for businesses that make things.",
  alternates: { canonical: "https://deneb4.com/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Deneb4"
        title={<>One person. <span style={{ color: "var(--accent-light)" }}>Every part of the build.</span></>}
        subtitle="I started Deneb4 because the businesses I grew up around were being handed generic websites that didn't earn their place."
      />

      {/* Founder story */}
      <section style={{ background: "var(--bg-surface)" }}>
        <Reveal variant="fade" className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="article-body">
            <p>
              My name is <strong>Ridhi</strong>. I have a computer science degree and I grew up in a family
              that did industrial and custom fabrication work. That combination is the reason this studio exists.
            </p>
            <p>
              Most web agencies don&apos;t understand what an engineering firm, a fabrication shop, or a controls
              integrator actually does for a living. They produce sites that look polished but say nothing
              specific: stock photos, vague copy, and a contact form buried at the bottom. Industrial buyers
              don&apos;t trust that. They can&apos;t.
            </p>
            <h2>Built for businesses that make things</h2>
            <p>
              Technical buyers evaluate credibility through specifics. They want tolerances, certifications,
              lead times, and real application examples. They want to know you&apos;ve done this before, at their
              scale, under their constraints. A website that can&apos;t answer those questions in the first 30
              seconds isn&apos;t a website: it&apos;s a liability.
            </p>
            <p>
              I build for companies that have never been well-served by generalist agencies: manufacturers,
              engineering firms, automation shops, fabricators, distributors with deep catalogs. If you sell
              something technical to careful buyers, I already speak the language.
            </p>
            <h2>Infrastructure, not a brochure</h2>
            <p>
              A website should be treated the same way you treat your other capital assets: something you own
              outright, built to last, and able to earn its keep for years. Not a monthly rental on someone
              else&apos;s platform. Not a rebuild every three years because the template stopped working.
            </p>
            <p>
              Every site I build is delivered as fully owned source code, with no mandatory retainer, no
              platform lock-in, and no surprise invoices. You can hand it to any competent developer and keep
              going. That&apos;s what it means to treat a website like infrastructure.
            </p>
            <h2>No intermediaries</h2>
            <p>
              You work directly with the person doing the work. No account managers, no handoffs, no telephone
              game. I handle strategy, design, development, and delivery, end to end. That&apos;s not a
              limitation. It&apos;s the point.
            </p>
          </div>
        </Reveal>
      </section>

      {/* How I work */}
      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold mb-14">
              What that looks like <span style={{ color: "var(--accent-light)" }}>in practice</span>
            </h2>
          </Reveal>
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-6" step={100}>
            {[
              {
                title: "Industry-first",
                body: "I already understand the language of engineers, procurement managers, and operations leads. No discovery fee for me to learn your world.",
              },
              {
                title: "Direct access",
                body: "You talk to the person doing the work, from first brief to final handover. No project managers or account executives in between.",
              },
              {
                title: "Owned, not rented",
                body: "You receive the full source code, all accounts in your name, and no mandatory retainer. Treat it like the capital asset it is.",
              },
              {
                title: "Fixed scope and price",
                body: "The quote comes before the work. Nothing outside that scope moves without your approval and a separate price.",
              },
            ].map((v) => (
              <div key={v.title} className="card card-glow p-8">
                <h3 className="text-lg font-bold mb-3" style={{ color: "var(--text-heading)" }}>{v.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{v.body}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <Reveal variant="scale-in">
            <CtaBanner
              title={<>Your site should work as hard as <span style={{ color: "var(--accent-light)" }}>you do.</span></>}
              body="Tell me what you make and who you sell to. I read every message personally and reply with a clear next step, usually within a day or two."
              primary={{ href: "/start", label: "Start a Project" }}
              secondary={{ href: "/contact", label: "Contact" }}
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}

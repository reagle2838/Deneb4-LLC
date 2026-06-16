import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "About",
  description:
    "Deneb4 was founded by Ridhi — a computer science background plus formative experience in industrial engineering and custom fabrication. One person, end to end, building websites as infrastructure for businesses that make things.",
  alternates: { canonical: "https://deneb4.com/about" },
};

const VALUES = [
  { title: "Industry-first thinking", body: "I already speak the language of engineers, procurement, and operations. No learning curve billed back to you as discovery." },
  { title: "Transparent process", body: "Fixed scope, fixed price, and sign-off at every phase. You always know what's happening and what's next." },
  { title: "No intermediaries", body: "You work directly with the person doing the work. No account managers, no telephone game, no agency overhead." },
  { title: "Code that lasts", body: "Built on modern, well-supported tools and handed to you outright — so it keeps its value instead of needing a rebuild." },
];

const DIFFERENTIATORS = [
  "One person handles strategy, design, build, and delivery — end to end.",
  "Deep industry literacy, not a generalist learning your business on your dime.",
  "Websites treated as high-performance infrastructure, not a digital brochure.",
  "You own the full source code and all data, with no mandatory retainer.",
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Deneb4"
        title="Built for businesses that make things."
        subtitle="A focused studio for industrial, engineering, and manufacturing companies — run by someone who actually understands what you do."
      />

      {/* Founder story */}
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="article-body">
            <p>
              Deneb4 was founded by <strong>Ridhi</strong>, combining two backgrounds that rarely sit together: a computer
              science degree, and formative, hands-on exposure to industrial engineering and custom fabrication
              through a family business. That combination is the whole point.
            </p>
            <h2>Why this studio exists</h2>
            <p>
              Industrial buyers — engineers, procurement managers, operations leaders — evaluate credibility and
              technical clarity differently than retail or hospitality customers. The usual playbook falls flat.
              <strong> Generic marketing fluff doesn&apos;t work. A polished brochure with stock photos of handshakes
              doesn&apos;t work.</strong>
            </p>
            <p>
              What works is a site that reads like it was built by someone who understands the work: specs that are
              easy to find, capabilities stated in the buyer&apos;s units, and a clear path to a quote. That&apos;s
              what a generalist agency struggles to deliver, and it&apos;s exactly where Deneb4 starts.
            </p>
            <h2>Infrastructure, not a brochure</h2>
            <p>
              A website should be treated as high-performance infrastructure — a capital asset you own — not a
              recurring rental on someone else&apos;s platform. Built well, on the right foundation, it keeps working
              and keeps its value for years. That principle shapes every decision here.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <h2 className="text-3xl sm:text-4xl font-bold mb-14">How I work</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="card p-8">
                <h3 className="text-lg font-bold mb-3" style={{ color: "var(--text-heading)" }}>{v.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">What makes it different</h2>
              <div className="flex flex-col gap-4">
                {DIFFERENTIATORS.map((d) => (
                  <div key={d} className="flex gap-3">
                    <div className="w-0.5 flex-shrink-0 mt-1 rounded-full" style={{ minHeight: "2.5rem", background: "var(--accent)" }} />
                    <p className="text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>{d}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="accent-banner card p-10">
              <p className="text-2xl font-bold leading-snug mb-4">&ldquo;Your site should work as hard as you do.&rdquo;</p>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>
                That&apos;s the whole brief. Let&apos;s build something that earns its place in your sales process.
              </p>
              <Link href="/start" className="btn-primary">Start a Project</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

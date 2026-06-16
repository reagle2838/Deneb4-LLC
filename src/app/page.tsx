import Link from "next/link";
import type { Metadata } from "next";
import Marquee from "@/components/ui/Marquee";
import FaqAccordion from "@/components/ui/FaqAccordion";
import { PACKAGES } from "@/data/services";
import { INDUSTRIES } from "@/data/industries";
import { PHASES } from "@/data/process";
import { FAQS } from "@/data/faq";
import { CREDENTIALS } from "@/data/nav";
import { articlesByDate } from "@/data/articles";

export const metadata: Metadata = {
  title: { absolute: "Deneb4 | Websites Built for Technical Businesses" },
  description:
    "Deneb4 designs and builds websites for industrial, engineering, and manufacturing businesses. Fixed-scope, fixed-price, and you own the code. Your site should work as hard as you do.",
  alternates: { canonical: "https://deneb4.com" },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.slice(0, 6).map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

function HeroMock() {
  return (
    <div className="relative w-full max-w-md">
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        {/* window chrome */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-accent)", background: "var(--bg-raised)" }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent)" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent-light)" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--text-faint)" }} />
          <span className="font-spec text-[10px] ml-3" style={{ color: "var(--text-faint)" }}>yoursite.com</span>
        </div>
        {/* blueprint body */}
        <div className="bg-grid p-6 space-y-4" style={{ minHeight: "300px" }}>
          <div className="badge inline-flex">UL 508A · 5,000–40,000 CFM</div>
          <div className="h-6 rounded-sm w-3/4" style={{ background: "var(--accent)" }} />
          <div className="h-3 rounded-sm w-full skeleton" />
          <div className="h-3 rounded-sm w-5/6 skeleton" />
          <div className="grid grid-cols-3 gap-3 pt-2">
            {["SPEC", "QUOTE", "CATALOG"].map((t) => (
              <div key={t} className="rounded-sm p-3 text-center" style={{ border: "1px solid var(--border-accent)", background: "var(--bg-surface)" }}>
                <span className="font-spec text-[10px]" style={{ color: "var(--accent-light)" }}>{t}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <div className="h-8 rounded-sm flex-1" style={{ background: "var(--accent)" }} />
            <div className="h-8 rounded-sm flex-1" style={{ border: "1px solid var(--accent)" }} />
          </div>
        </div>
      </div>
      <span className="absolute -top-3 -right-3 spec-tag">Next.js · owned by you</span>
    </div>
  );
}

export default function HomePage() {
  const articles = articlesByDate().slice(0, 3);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* ── Hero + Marquee ───────────────────────────────────────── */}
      <div className="flex flex-col hero-viewport-lock">
        <section className="flex-1 min-h-0 flex items-center overflow-y-auto" style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-accent)" }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-5" style={{ color: "var(--accent-light)" }}>
                  Deneb4 · Web design & development
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5">
                  Websites built for technical businesses.
                </h1>
                <p className="text-lg sm:text-xl leading-relaxed mb-8" style={{ color: "var(--text-muted)" }}>
                  Deneb4 builds high-performance websites for industrial, engineering, and manufacturing
                  companies. Fixed scope, fixed price, and you own the code. Your site should work as hard as you do.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/start" className="btn-primary">Start a Project</Link>
                  <Link href="/services" className="btn-outline">See Services &amp; Pricing</Link>
                </div>
                <p className="font-spec text-xs mt-8" style={{ color: "var(--text-faint)" }}>
                  Built for businesses that make things · 10–250 employees · B2B, quote-driven
                </p>
              </div>
              <div className="hidden lg:flex justify-end">
                <HeroMock />
              </div>
            </div>
          </div>
        </section>
        <div className="flex-shrink-0">
          <Marquee />
        </div>
      </div>

      {/* ── Credentials strip ────────────────────────────────────── */}
      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {CREDENTIALS.map((item, i) => (
              <div key={item.stat} className="flex flex-col items-center text-center py-10 px-4" style={{ borderRight: i < CREDENTIALS.length - 1 ? "1px solid var(--border-accent)" : undefined }}>
                <span className="font-bold mb-1 leading-tight text-2xl sm:text-3xl" style={{ color: "var(--text-heading)" }}>{item.stat}</span>
                <span className="text-xs font-spec tracking-wide leading-snug mt-2" style={{ color: "var(--text-muted)" }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services preview ─────────────────────────────────────── */}
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="flex items-end justify-between gap-6 mb-14">
            <div className="max-w-2xl">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Three ways to start</h2>
              <p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Every package is a complete, custom build you own outright — priced by scope, never by the hour.
              </p>
            </div>
            <Link href="/services" className="btn-outline flex-shrink-0 hidden sm:inline-flex">All Services →</Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {PACKAGES.map((p) => (
              <div key={p.id} className="card p-8 flex flex-col gap-5" style={p.featured ? { borderColor: "var(--accent)", boxShadow: "0 4px 24px rgba(0,107,143,0.14)" } : undefined}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold" style={{ color: "var(--text-heading)" }}>{p.name}</h3>
                  {p.featured && <span className="badge">Most popular</span>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" style={{ color: "var(--accent-light)" }}>{p.price}</span>
                  <span className="font-spec text-xs" style={{ color: "var(--text-faint)" }}>{p.pages}</span>
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: "var(--text-muted)" }}>{p.tagline}</p>
                <ul className="space-y-2">
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                      <span style={{ color: "var(--accent)" }} className="mt-1 text-[8px] flex-shrink-0">●</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/start" className={`${p.featured ? "btn-primary" : "btn-outline"} justify-center text-sm mt-auto`}>Start with {p.name}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Process ──────────────────────────────────────────────── */}
      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="mb-14 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">A transparent, four-phase process</h2>
            <p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
              No vague timelines. No black-box delivery. Each phase needs your sign-off before the next begins.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PHASES.map((phase) => (
              <div key={phase.n} className="card p-7 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-spec text-2xl font-bold" style={{ color: "var(--accent-light)" }}>{phase.n}</span>
                  <span className="spec-tag">{phase.weeks}</span>
                </div>
                <h3 className="font-bold" style={{ color: "var(--text-heading)" }}>{phase.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{phase.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-10"><Link href="/process" className="btn-outline text-sm">See the full process →</Link></div>
        </div>
      </section>

      {/* ── Industries ───────────────────────────────────────────── */}
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="mb-14 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for businesses that make things</h2>
            <p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Industry literacy is the difference. No learning curve, no stock-photo fluff — just sites that speak your buyers&apos; language.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {INDUSTRIES.map((s) => (
              <Link key={s.slug} href={`/industries#${s.slug}`} className="card p-7 flex flex-col gap-2 no-underline">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-heading)" }}>{s.label}</h3>
                  <span className="font-spec text-[9px] tracking-widest" style={{ color: "var(--accent-light)" }}>{s.spec}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured work ────────────────────────────────────────── */}
      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="accent-banner card p-10 flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1">
              <span className="badge mb-4 inline-flex">Featured Case Study</span>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Eagle Engineering & Supply Co.</h2>
              <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
                A 55-year-old, multi-division industrial firm — electrical controls, proprietary material
                handling, authorized distribution — rebuilt as owned infrastructure. The full-screen mega
                menu and blueprint design system you&apos;re using right now started there.
              </p>
              <Link href="/work" className="btn-outline text-sm">View the work →</Link>
            </div>
            <div className="flex flex-col gap-3 lg:w-56 flex-shrink-0 w-full">
              {[
                { k: "Sector", v: "Industrial engineering" },
                { k: "Scope", v: "Multi-division + catalog" },
                { k: "Stack", v: "Next.js · owned outright" },
              ].map((row) => (
                <div key={row.k} className="flex flex-col" style={{ borderTop: "1px solid var(--border-accent)", paddingTop: "0.5rem" }}>
                  <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{row.k}</span>
                  <span className="text-sm" style={{ color: "var(--text-heading)" }}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── From the studio (articles) ───────────────────────────── */}
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="flex items-end justify-between gap-6 mb-14">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold">From the studio</h2>
              <p className="text-base mt-2 max-w-xl" style={{ color: "var(--text-muted)" }}>
                Plain-spoken pieces on building websites that pull their weight.
              </p>
            </div>
            <Link href="/articles" className="btn-outline flex-shrink-0 hidden sm:inline-flex">All Articles →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {articles.map((a) => (
              <Link key={a.slug} href={`/articles/${a.slug}`} className="card flex flex-col no-underline group overflow-hidden">
                <div className="relative h-32 flex-shrink-0 bg-grid flex items-end p-4" style={{ borderBottom: "1px solid var(--border-accent)" }}>
                  <span className="font-spec text-[10px] tracking-widest px-2 py-0.5 rounded-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-accent)", color: "var(--accent-light)" }}>{a.type}</span>
                </div>
                <div className="p-6 flex flex-col gap-2 flex-1">
                  <span className="font-spec text-[10px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>{a.topic} · {a.readTime}</span>
                  <h3 className="text-sm font-semibold leading-snug group-hover:underline" style={{ color: "var(--text-heading)" }}>{a.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{a.subtitle.length > 110 ? a.subtitle.slice(0, 110) + "…" : a.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="mb-14"><h2 className="text-3xl sm:text-4xl font-bold">Questions clients ask first</h2></div>
          <FaqAccordion faqs={FAQS.slice(0, 6)} />
          <div className="mt-10"><Link href="/faq" className="btn-outline text-sm">All questions →</Link></div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="card p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8" style={{ background: "linear-gradient(135deg, rgba(0,107,143,0.10) 0%, var(--bg-surface) 100%)", borderLeft: "3px solid var(--accent)" }}>
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Let&apos;s talk about your project.</h2>
              <p className="text-sm leading-relaxed max-w-xl mb-4" style={{ color: "var(--text-muted)" }}>
                Tell me what you make and who you sell to. I read every message personally and reply with a clear next step, usually within a day or two.
              </p>
              <p className="font-spec text-[10px] tracking-wide" style={{ color: "var(--text-faint)" }}>hello@deneb4.com · Mon–Fri 9am–5pm EST</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <Link href="/start" className="btn-primary">Start a Project</Link>
              <Link href="/contact" className="btn-outline">Contact</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about a website for your technical business? Email hello@deneb4.com or send a message. Every message gets a personal reply, usually within a day or two.",
  alternates: { canonical: "https://deneb4.com/contact" },
};

export default function ContactPage() {
  return (
    <section className="bg-grid" style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Left: copy */}
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-5" style={{ color: "var(--accent-light)" }}>Contact</p>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-5">Let&apos;s talk about your project.</h1>
            <p className="text-lg leading-relaxed mb-8" style={{ color: "var(--text-muted)" }}>
              I read every message personally and reply with a clear next step, usually within a day or two. No automated sequences.
            </p>
            <div className="space-y-5">
              <div>
                <p className="font-spec text-xs tracking-widest uppercase mb-1" style={{ color: "var(--text-faint)" }}>Email</p>
                <a href="mailto:hello@deneb4.com" className="text-lg" style={{ color: "var(--accent-light)" }}>hello@deneb4.com</a>
              </div>
              <div>
                <p className="font-spec text-xs tracking-widest uppercase mb-1" style={{ color: "var(--text-faint)" }}>Hours</p>
                <p style={{ color: "var(--text-primary)" }}>Monday–Friday · 9am–5pm EST</p>
              </div>
            </div>
            <div className="accent-banner card p-5 mt-8">
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Ready to start? The <Link href="/start" style={{ color: "var(--accent-light)" }}>project brief</Link> helps me come back with a scoped proposal faster.
              </p>
            </div>
          </div>

          {/* Right: form */}
          <div className="lg:col-span-3">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}

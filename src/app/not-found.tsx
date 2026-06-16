import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="bg-grid" style={{ background: "var(--bg-surface)" }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-32 text-center">
        <p className="font-spec text-6xl font-bold mb-4" style={{ color: "var(--accent-light)" }}>404</p>
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">This page isn&apos;t in the spec.</h1>
        <p className="text-lg leading-relaxed mb-8 max-w-xl mx-auto" style={{ color: "var(--text-muted)" }}>
          The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get you back on track.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/" className="btn-primary">Back to home</Link>
          <Link href="/services" className="btn-outline">See Services</Link>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../../../keystatic.config";
import { marked } from "marked";
import PageHero from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Deneb4 terms of service.",
  alternates: { canonical: "https://deneb4.com/terms" },
};

export default async function TermsPage() {
  const reader = createReader(process.cwd(), keystaticConfig);
  const page = await reader.singletons.termsOfService.read();
  const bodyHtml = page?.body ? (marked.parse(page.body) as string) : null;

  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of Service" />
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          {bodyHtml ? (
            <div className="article-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Terms of service coming soon.</p>
          )}
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../../../keystatic.config";
import { marked } from "marked";
import PageHero from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Deneb4 privacy policy.",
  alternates: { canonical: "https://deneb4.com/privacy" },
};

export default async function PrivacyPage() {
  const reader = createReader(process.cwd(), keystaticConfig);
  const page = await reader.singletons.privacyPolicy.read();
  const bodyHtml = page?.body ? (marked.parse(page.body) as string) : null;

  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" />
      <section style={{ background: "var(--bg-surface)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          {bodyHtml ? (
            <div className="article-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Privacy policy coming soon.</p>
          )}
        </div>
      </section>
    </>
  );
}

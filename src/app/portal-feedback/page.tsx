import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPortalSession } from "@/lib/portal-auth";
import { getClientBySlug } from "@/lib/clients";
import FeedbackPanel from "./FeedbackPanel";

export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

export default async function PortalFeedbackPage() {
  const token = (await cookies()).get("portal_session")?.value;
  const slug = await verifyPortalSession(token);
  if (!slug) redirect("/login");

  const client = await getClientBySlug(slug);
  if (!client || !client.active) redirect("/login");

  const stagingUrl = client.staging.url
    ? (/^https?:\/\//i.test(client.staging.url) ? client.staging.url : `https://${client.staging.url}`)
    : "";

  return (
    <main style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <div className="px-4 py-5 mx-auto" style={{ maxWidth: "28rem" }}>
        <div className="mb-4">
          <p className="font-spec text-[10px] tracking-widest uppercase mb-1" style={{ color: "var(--accent-light)" }}>Feedback &amp; suggestions</p>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-heading)" }}>{client.projectName || "Your project"}</h1>
        </div>

        {stagingUrl && (
          <a
            href={stagingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-sm w-full justify-center mb-4"
          >
            Open staging site →
          </a>
        )}

        <FeedbackPanel initial={client.feedback} canComment={client.feedbackOpen} />
      </div>
    </main>
  );
}

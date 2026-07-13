import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPortalSession } from "@/lib/portal-auth";
import { getClientBySlug, countUnreadForClient } from "@/lib/clients";
import { getProposedInvoices } from "@/lib/billing";
import { loadPricing } from "@/lib/pricing";
import PortalView, { type PortalData } from "./PortalView";

export const metadata: Metadata = {
  title: "Client Portal",
  description: "Deneb4 client portal.",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  const token = (await cookies()).get('portal_session')?.value;
  const clientSlug = await verifyPortalSession(token);
  if (!clientSlug) redirect('/login');

  const client = await getClientBySlug(clientSlug);
  if (!client || !client.active) redirect('/login');

  // Line items for the client's SENT invoices (their own billing detail —
  // internal drafts/rejections never leave the server).
  const invoiceLines: Record<string, { label: string; amount: string }[]> = {};
  for (const p of getProposedInvoices(client.slug)) {
    if (p.status === 'sent') invoiceLines[p.description] = p.lines;
  }

  // Only pass what the portal needs (no email/passwordHash to the client).
  const data: PortalData = {
    slug: client.slug,
    name: client.name,
    projectName: client.projectName,
    stage: client.stage,
    driveFolder: client.driveFolder,
    staging: client.staging,
    updates: client.updates,
    files: client.files,
    revisions: client.revisions,
    invoices: client.invoices,
    invoiceLines,
    paymentInstructions: loadPricing().paymentInstructions,
    feedbackOpen: client.feedbackOpen,
    feedback: client.feedback,
    unreadMessages: countUnreadForClient(client),
  };

  return <PortalView client={data} />;
}

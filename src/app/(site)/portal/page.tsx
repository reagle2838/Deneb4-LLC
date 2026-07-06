import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPortalSession } from "@/lib/portal-auth";
import { getClientBySlug, countUnreadForClient } from "@/lib/clients";
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
    feedbackOpen: client.feedbackOpen,
    feedback: client.feedback,
    unreadMessages: countUnreadForClient(client),
  };

  return <PortalView client={data} />;
}

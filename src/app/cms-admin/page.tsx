import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/cms-auth";
import { getAllClients } from "@/lib/clients";
import { getLeads } from "@/lib/leads";
import { getTasks } from "@/lib/tasks";
import { getNotes } from "@/lib/notes";
import { getQuickLinks } from "@/lib/quick-links";
import { getAllLedgers } from "@/lib/agent-ledger";
import { getRecentRuns } from "@/lib/agent-runs";
import Workspace from "./Workspace";

export const dynamic = "force-dynamic";

export default async function CmsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; client?: string }>;
}) {
  const token = (await cookies()).get("cms_auth")?.value;
  if (!(await verifySession(token))) redirect("/cms-login");

  const { tab, client } = await searchParams;

  const clients = await getAllClients();
  const leads = getLeads();
  const tasks = getTasks();
  const notes = getNotes();
  const quickLinks = getQuickLinks();
  const agentLedgers = getAllLedgers();
  const agentRuns = getRecentRuns(20);
  const readiness = {
    resend: Boolean(process.env.RESEND_API_KEY),
    calendar: Boolean(process.env.GOOGLE_CALENDAR_ICS_URL),
    agentKey: Boolean(process.env.AGENT_API_KEY),
    cmsAuthDisabled: process.env.CMS_AUTH_DISABLED === "true",
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <p className="font-spec text-xs tracking-widest uppercase mb-2" style={{ color: "var(--accent-light)" }}>Workspace</p>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-heading)" }}>Command Center</h1>
        </div>

        <Workspace
          clients={clients}
          leads={leads}
          tasks={tasks}
          notes={notes}
          quickLinks={quickLinks}
          agentLedgers={agentLedgers}
          agentRuns={agentRuns}
          agentReadiness={readiness}
          initialTab={tab}
          initialClient={client}
        />
      </div>
    </div>
  );
}

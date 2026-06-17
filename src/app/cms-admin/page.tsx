import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/cms-auth";
import { getAllClients } from "@/lib/clients";
import { getLeads } from "@/lib/leads";
import { getTasks } from "@/lib/tasks";
import { getNotes } from "@/lib/notes";
import Workspace from "./Workspace";

export const dynamic = "force-dynamic";

export default async function CmsAdminPage() {
  const token = (await cookies()).get("cms_auth")?.value;
  if (!(await verifySession(token))) redirect("/cms-login");

  const clients = await getAllClients();
  const leads = getLeads();
  const tasks = getTasks();
  const notes = getNotes();

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <p className="font-spec text-xs tracking-widest uppercase mb-2" style={{ color: "var(--accent-light)" }}>Workspace</p>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-heading)" }}>Command Center</h1>
        </div>

        <Workspace clients={clients} leads={leads} tasks={tasks} notes={notes} />
      </div>
    </div>
  );
}

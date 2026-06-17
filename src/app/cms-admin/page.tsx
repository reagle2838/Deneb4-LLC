import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/cms-auth";
import { getAllClients } from "@/lib/clients";
import ClientManagerUI from "./ClientManagerUI";

export const dynamic = "force-dynamic";

export default async function CmsAdminPage() {
  const token = (await cookies()).get("cms_auth")?.value;
  if (!(await verifySession(token))) redirect("/cms-login");

  const clients = await getAllClients();

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <p className="font-spec text-xs tracking-widest uppercase mb-2" style={{ color: "var(--accent-light)" }}>Admin</p>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>Client Manager</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Add clients, generate portal passwords, and manage everything in their portal: project updates, shared files, revisions, and invoices.
          </p>
        </div>

        <ClientManagerUI initialClients={clients} />
      </div>
    </div>
  );
}

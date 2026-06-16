import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/cms-auth";
import { getAllClients } from "@/lib/clients";
import ClientManagerUI from "./ClientManagerUI";

export default async function CmsAdminPage() {
  const token = (await cookies()).get("cms_auth")?.value;
  if (!(await verifySession(token))) redirect("/cms-login");

  const clients = await getAllClients();

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "calc(100vh - 96px)" }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <p className="font-spec text-xs tracking-widest uppercase mb-2" style={{ color: "var(--accent-light)" }}>Admin</p>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>Client Manager</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Generate portal passwords and manage client access. Use{" "}
            <a href="/keystatic/collections/clients" style={{ color: "var(--accent-light)" }}>Keystatic</a>{" "}
            to edit client details and portal content.
          </p>
        </div>

        <ClientManagerUI clients={clients.map((c) => ({ slug: c.slug, name: c.name, email: c.email, active: c.active, hasPassword: !!c.passwordHash }))} />
      </div>
    </div>
  );
}

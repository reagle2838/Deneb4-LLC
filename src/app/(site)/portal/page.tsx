import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPortalSession } from "@/lib/portal-auth";
import { getClientBySlug } from "@/lib/clients";
import type { ClientUpdate, ClientFile, ClientRevision, ClientInvoice } from "@/lib/clients";

export const metadata: Metadata = {
  title: "Client Portal",
  description: "Deneb4 client portal.",
  robots: { index: false, follow: false },
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    upcoming:         { label: 'Upcoming',         color: 'var(--text-faint)' },
    'in-progress':    { label: 'In Progress',       color: 'var(--accent-light)' },
    'pending-signoff':{ label: 'Pending Sign-off',  color: '#d97706' },
    complete:         { label: 'Complete',           color: '#16a34a' },
    requested:        { label: 'Requested',          color: '#d97706' },
    pending:          { label: 'Pending',            color: 'var(--text-faint)' },
    paid:             { label: 'Paid',               color: '#16a34a' },
    overdue:          { label: 'Overdue',            color: '#e40014' },
  };
  const s = map[status] ?? { label: status, color: 'var(--text-faint)' };
  return (
    <span className="font-spec text-[10px] tracking-widest" style={{ color: s.color }}>
      {s.label.toUpperCase()}
    </span>
  );
}

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function PortalPage() {
  const token = (await cookies()).get('portal_session')?.value;
  const clientSlug = await verifyPortalSession(token);
  if (!clientSlug) redirect('/login');

  const client = await getClientBySlug(clientSlug);
  if (!client || !client.active) redirect('/login');

  return (
    <section style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="mb-10">
          <p className="font-spec text-xs tracking-widest uppercase mb-2" style={{ color: "var(--accent-light)" }}>Client Portal</p>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>
            Welcome, {client.name.split(' ')[0]}.
          </h1>
          {client.projectName && (
            <p className="text-base" style={{ color: "var(--text-muted)" }}>
              Project: <span style={{ color: "var(--text-heading)" }}>{client.projectName}</span>
            </p>
          )}
        </div>

        <div className="space-y-8">

          {/* Project Updates */}
          <div className="card overflow-hidden">
            <div className="px-7 py-5" style={{ borderBottom: "1px solid var(--border-accent)" }}>
              <h2 className="font-semibold" style={{ color: "var(--text-heading)" }}>Project Updates</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>Phase status, sign-off checkpoints, and timeline.</p>
            </div>
            {client.updates.length === 0 ? (
              <EmptyState message="No updates yet. Check back soon." />
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border-accent)" }}>
                {client.updates.map((u: ClientUpdate, i: number) => (
                  <div key={i} className="px-7 py-5">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <p className="font-medium text-sm" style={{ color: "var(--text-heading)" }}>{u.phase}</p>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusPill status={u.status} />
                        {u.date && <span className="font-spec text-[10px]" style={{ color: "var(--text-faint)" }}>{formatDate(u.date)}</span>}
                      </div>
                    </div>
                    {u.notes && <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{u.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shared Files */}
          <div className="card overflow-hidden">
            <div className="px-7 py-5" style={{ borderBottom: "1px solid var(--border-accent)" }}>
              <h2 className="font-semibold" style={{ color: "var(--text-heading)" }}>Shared Files</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>Design files, briefs, and deliverables.</p>
            </div>
            {client.files.length === 0 ? (
              <EmptyState message="No files shared yet." />
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border-accent)" }}>
                {client.files.map((f: ClientFile, i: number) => (
                  <div key={i} className="px-7 py-4 flex items-start justify-between gap-4">
                    <div>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium" style={{ color: "var(--accent-light)" }}>
                        {f.name} →
                      </a>
                      {f.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{f.description}</p>}
                    </div>
                    {f.date && <span className="font-spec text-[10px] flex-shrink-0 mt-0.5" style={{ color: "var(--text-faint)" }}>{formatDate(f.date)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedback & Revisions */}
          <div className="card overflow-hidden">
            <div className="px-7 py-5" style={{ borderBottom: "1px solid var(--border-accent)" }}>
              <h2 className="font-semibold" style={{ color: "var(--text-heading)" }}>Feedback & Revisions</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>Revision requests tracked by phase.</p>
            </div>
            {client.revisions.length === 0 ? (
              <EmptyState message="No revision requests yet." />
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border-accent)" }}>
                {client.revisions.map((r: ClientRevision, i: number) => (
                  <div key={i} className="px-7 py-5">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <p className="text-xs font-spec uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>{r.phase}</p>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusPill status={r.status} />
                        {r.date && <span className="font-spec text-[10px]" style={{ color: "var(--text-faint)" }}>{formatDate(r.date)}</span>}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{r.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="card overflow-hidden">
            <div className="px-7 py-5" style={{ borderBottom: "1px solid var(--border-accent)" }}>
              <h2 className="font-semibold" style={{ color: "var(--text-heading)" }}>Invoices</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>Project invoices and payment history.</p>
            </div>
            {client.invoices.length === 0 ? (
              <EmptyState message="No invoices yet." />
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border-accent)" }}>
                {client.invoices.map((inv: ClientInvoice, i: number) => (
                  <div key={i} className="px-7 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-heading)" }}>{inv.description}</p>
                      {inv.dueDate && <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>Due {formatDate(inv.dueDate)}</p>}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="font-spec font-semibold text-sm" style={{ color: "var(--text-heading)" }}>{inv.amount}</span>
                      <StatusPill status={inv.status} />
                      {inv.invoiceUrl && (
                        <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-spec text-[10px]" style={{ color: "var(--accent-light)" }}>PDF →</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 card p-7 accent-banner">
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Questions about your project? Email{" "}
            <a href="mailto:hello@deneb4.com" style={{ color: "var(--accent-light)" }}>hello@deneb4.com</a>
            {" "}or use the{" "}
            <Link href="/contact" style={{ color: "var(--accent-light)" }}>contact form</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-7 py-8 text-center">
      <p className="text-sm" style={{ color: "var(--text-faint)" }}>{message}</p>
    </div>
  );
}

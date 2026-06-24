'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BUILD_STAGES } from '@/lib/stages';
import type { ClientUpdate, ClientFile, ClientRevision, ClientInvoice, ClientStaging, ClientFeedback } from '@/lib/clients';

export interface PortalData {
  slug: string;
  name: string;
  projectName: string;
  stage: string;
  driveFolder: string;
  staging: ClientStaging;
  updates: ClientUpdate[];
  files: ClientFile[];
  revisions: ClientRevision[];
  invoices: ClientInvoice[];
  feedbackOpen: boolean;
  feedback: ClientFeedback[];
}

type SectionKey = 'updates' | 'files' | 'revisions' | 'invoices';
const SECTION_KEYS: SectionKey[] = ['updates', 'files', 'revisions', 'invoices'];

function sig(item: unknown): string {
  return JSON.stringify(item);
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    upcoming: { label: 'Upcoming', color: 'var(--text-faint)' },
    'in-progress': { label: 'In Progress', color: 'var(--accent-light)' },
    'pending-signoff': { label: 'Pending Sign-off', color: '#d97706' },
    complete: { label: 'Complete', color: '#16a34a' },
    requested: { label: 'Requested', color: '#d97706' },
    pending: { label: 'Pending', color: 'var(--text-faint)' },
    paid: { label: 'Paid', color: '#16a34a' },
    overdue: { label: 'Overdue', color: '#e40014' },
    building: { label: 'Building', color: 'var(--text-faint)' },
    ready: { label: 'Ready for Review', color: 'var(--accent-light)' },
    live: { label: 'Live', color: '#16a34a' },
    down: { label: 'Down for Updates', color: '#d97706' },
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

export default function PortalView({ client }: { client: PortalData }) {
  const items: Record<SectionKey, unknown[]> = {
    updates: client.updates,
    files: client.files,
    revisions: client.revisions,
    invoices: client.invoices,
  };

  // Seen tracking (per client, in the browser). `initialSeen` is captured
  // once so NEW badges stay stable for the whole visit, then everything is
  // marked seen shortly after load so the next visit is clean.
  const storageKey = `deneb4-portal-seen-${client.slug}`;
  const [initialSeen, setInitialSeen] = useState<Record<string, string[]> | null>(null);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    updates: false,
    files: true, // Shared Files starts expanded
    revisions: false,
    invoices: false,
  });
  const refs = {
    updates: useRef<HTMLDivElement>(null),
    files: useRef<HTMLDivElement>(null),
    revisions: useRef<HTMLDivElement>(null),
    invoices: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    let parsed: Record<string, string[]> = {};
    try {
      parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      parsed = {};
    }
    setInitialSeen(parsed);

    // Shared Files starts expanded; other sections auto-open if they have
    // unseen items.
    const nextOpen = { updates: false, files: true, revisions: false, invoices: false } as Record<SectionKey, boolean>;
    for (const key of SECTION_KEYS) {
      const seenSigs = parsed[key] ?? [];
      const hasNew = items[key].some((it) => !seenSigs.includes(sig(it)));
      if (hasNew) nextOpen[key] = true;
    }
    setOpen(nextOpen);

    // After the client has had a moment to see it, persist everything as seen.
    const t = setTimeout(() => {
      const all: Record<string, string[]> = { ...parsed };
      for (const key of SECTION_KEYS) all[key] = items[key].map(sig);
      try {
        localStorage.setItem(storageKey, JSON.stringify(all));
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function newCount(key: SectionKey): number {
    if (!initialSeen) return 0;
    const seenSigs = initialSeen[key] ?? [];
    return items[key].filter((it) => !seenSigs.includes(sig(it))).length;
  }

  function toggle(key: SectionKey) {
    setOpen((o) => ({ ...o, [key]: !o[key] }));
  }

  function jumpTo(key: SectionKey) {
    setOpen((o) => ({ ...o, [key]: true }));
    setTimeout(() => refs[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  const hasStaging = client.staging.url || client.staging.username || client.staging.notes;

  const tiles: { key: SectionKey; label: string; value: number }[] = [
    { key: 'updates', label: 'Updates', value: client.updates.length },
    { key: 'files', label: 'Files', value: client.files.length },
    { key: 'invoices', label: 'Invoices', value: client.invoices.length },
  ];

  return (
    <section style={{ background: 'var(--bg-base)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="mb-8">
          <p className="font-spec text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--accent-light)' }}>Client Portal</p>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>
            Welcome, {client.name.split(' ')[0]}.
          </h1>
          {client.projectName && (
            <p className="text-base" style={{ color: 'var(--text-muted)' }}>
              Project: <span style={{ color: 'var(--text-heading)' }}>{client.projectName}</span>
            </p>
          )}
        </div>

        {/* Folders: Shared Files + Invoices */}
        <div className="space-y-3 mb-6">
          <FolderSection
            sectionRef={refs.files}
            title="Shared Files"
            count={client.files.length}
            isNew={newCount('files')}
            open={open.files}
            onToggle={() => toggle('files')}
            empty="No files shared yet."
            prepend={
              client.driveFolder ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Upload your files</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Add briefs, assets, or content to our shared Google Drive folder.</p>
                  </div>
                  <a href={client.driveFolder} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex-shrink-0">
                    Upload to shared folder →
                  </a>
                </div>
              ) : undefined
            }
          >
            {client.files.map((f, i) => (
              <div key={i} className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderTop: '1px solid var(--border-accent)' }}>
                <div>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium" style={{ color: 'var(--accent-light)' }}>{f.name} →</a>
                  {f.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.description}</p>}
                </div>
                {f.date && <span className="font-spec text-[10px] flex-shrink-0 mt-0.5" style={{ color: 'var(--text-faint)' }}>{formatDate(f.date)}</span>}
              </div>
            ))}
          </FolderSection>

          <FolderSection
            sectionRef={refs.invoices}
            title="Invoices"
            count={client.invoices.length}
            isNew={newCount('invoices')}
            open={open.invoices}
            onToggle={() => toggle('invoices')}
            empty="No invoices yet."
          >
            {client.invoices.map((inv, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between gap-4" style={{ borderTop: '1px solid var(--border-accent)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{inv.description}</p>
                  {inv.dueDate && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Due {formatDate(inv.dueDate)}</p>}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="font-spec font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>{inv.amount}</span>
                  <StatusPill status={inv.status} />
                  {inv.invoiceUrl && (
                    <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-spec text-[10px]" style={{ color: 'var(--accent-light)' }}>PDF →</a>
                  )}
                </div>
              </div>
            ))}
          </FolderSection>
        </div>

        {/* Build progress */}
        <ProgressBar currentIndex={(BUILD_STAGES as readonly string[]).indexOf(client.stage)} />

        {/* Snapshot tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {tiles.map((t) => {
            const n = newCount(t.key);
            return (
              <button
                key={t.key}
                onClick={() => jumpTo(t.key)}
                className="card p-4 text-left relative transition-transform hover:-translate-y-0.5"
              >
                {n > 0 && (
                  <span className="absolute top-3 right-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-light)' }} />
                    <span className="font-spec text-[10px] tracking-widest" style={{ color: 'var(--accent-light)' }}>{n} NEW</span>
                  </span>
                )}
                <p className="text-3xl font-bold" style={{ color: 'var(--text-heading)' }}>{t.value}</p>
                <p className="font-spec text-[11px] tracking-widest uppercase mt-1" style={{ color: 'var(--text-faint)' }}>{t.label}</p>
              </button>
            );
          })}
        </div>

        {/* Staging highlight */}
        {hasStaging && (
          <div className="card p-5 mb-6" style={{ borderColor: 'var(--accent-light)' }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Staging Site</h2>
                  <StatusPill status={client.staging.status} />
                </div>
                {client.staging.notes && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{client.staging.notes}</p>}
                {(client.staging.username || client.staging.password) && (
                  <div className="flex flex-wrap gap-x-8 gap-y-1 mt-2">
                    {client.staging.username && (
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>User: <span className="font-spec" style={{ color: 'var(--text-heading)' }}>{client.staging.username}</span></p>
                    )}
                    {client.staging.password && (
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Pass: <span className="font-spec" style={{ color: 'var(--text-heading)' }}>{client.staging.password}</span></p>
                    )}
                  </div>
                )}
              </div>
              {client.staging.url && (
                <a
                  href={/^https?:\/\//i.test(client.staging.url) ? client.staging.url : `https://${client.staging.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-sm flex-shrink-0"
                >
                  Open staging site →
                </a>
              )}
            </div>
            {(client.feedbackOpen || client.feedback.length > 0) && (
              <p className="text-xs mt-3 flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: 'var(--text-faint)' }}>
                <span>
                  {client.feedbackOpen
                    ? 'Look for the feedback bubble on your staging site — drag it anywhere and comment as you browse.'
                    : 'Your feedback history stays available.'}
                </span>
                <a href="/portal-feedback" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-light)' }}>
                  View feedback &amp; history →
                </a>
              </p>
            )}
          </div>
        )}

        {/* Collapsible sections */}
        <div className="space-y-3">
          <AccordionSection
            sectionRef={refs.updates}
            title="Project Updates"
            subtitle="Phase status, sign-off checkpoints, and timeline."
            count={client.updates.length}
            isNew={newCount('updates')}
            open={open.updates}
            onToggle={() => toggle('updates')}
            empty="No updates yet."
          >
            {client.updates.map((u, i) => (
              <div key={i} className="px-6 py-4" style={{ borderTop: '1px solid var(--border-accent)' }}>
                <div className="flex items-start justify-between gap-4 mb-1">
                  <p className="font-medium text-sm" style={{ color: 'var(--text-heading)' }}>{u.phase}</p>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusPill status={u.status} />
                    {u.date && <span className="font-spec text-[10px]" style={{ color: 'var(--text-faint)' }}>{formatDate(u.date)}</span>}
                  </div>
                </div>
                {u.notes && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{u.notes}</p>}
              </div>
            ))}
          </AccordionSection>
        </div>

        <div className="mt-8 card p-6 accent-banner">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Questions about your project? Email{' '}
            <a href="mailto:hello@deneb4.com" style={{ color: 'var(--accent-light)' }}>hello@deneb4.com</a>{' '}or use the{' '}
            <Link href="/contact" style={{ color: 'var(--accent-light)' }}>contact form</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}

function ProgressBar({ currentIndex }: { currentIndex: number }) {
  const pct = currentIndex < 0
    ? 0
    : Math.round((currentIndex / (BUILD_STAGES.length - 1)) * 100);
  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Project Progress</h2>
        <span className="font-spec text-xs tracking-widest" style={{ color: currentIndex < 0 ? 'var(--text-faint)' : 'var(--accent-light)' }}>
          {currentIndex < 0 ? 'NOT STARTED' : BUILD_STAGES[currentIndex].toUpperCase()}
        </span>
      </div>
      <div className="flex items-start">
        {BUILD_STAGES.map((stage, i) => {
          const done = i <= currentIndex;
          return (
            <div key={stage} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <span
                  className="absolute h-0.5"
                  style={{ top: '7px', left: '-50%', width: '100%', background: i <= currentIndex ? 'var(--accent)' : 'var(--border-accent)' }}
                />
              )}
              <span
                className="relative z-10 rounded-full"
                style={{
                  width: '16px',
                  height: '16px',
                  background: done ? 'var(--accent)' : 'var(--bg-surface)',
                  border: `2px solid ${done ? 'var(--accent)' : 'var(--border-accent)'}`,
                }}
              />
              <span
                className="mt-2 text-center text-xs px-1"
                style={{ color: done ? 'var(--text-heading)' : 'var(--text-faint)', fontWeight: i === currentIndex ? 600 : 400 }}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>
      <p className="font-spec text-[11px] tracking-widest mt-4" style={{ color: 'var(--text-faint)' }}>{pct}% COMPLETE</p>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden className="flex-shrink-0">
      <path
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.8a1.5 1.5 0 0 1 1.06.44L10.6 6.5h8.9A1.5 1.5 0 0 1 21 8v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V6.5Z"
        fill="var(--accent)"
        fillOpacity="0.14"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderSection({
  title,
  count,
  isNew,
  open,
  onToggle,
  empty,
  children,
  sectionRef,
  prepend,
}: {
  title: string;
  count: number;
  isNew: number;
  open: boolean;
  onToggle: () => void;
  empty: string;
  children: React.ReactNode;
  sectionRef: React.RefObject<HTMLDivElement | null>;
  prepend?: React.ReactNode;
}) {
  const edge = open ? 'var(--accent)' : 'var(--border-accent)';
  return (
    <div ref={sectionRef} className="scroll-mt-24">
      {/* Folder tab */}
      <div
        style={{
          width: '44%',
          maxWidth: '220px',
          height: '16px',
          background: 'var(--bg-surface)',
          borderTop: `1px solid ${edge}`,
          borderLeft: `1px solid ${edge}`,
          borderRight: `1px solid ${edge}`,
          borderRadius: '8px 14px 0 0',
        }}
      />
      {/* Folder body */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${edge}`,
          borderRadius: '0 10px 10px 10px',
          marginTop: '-1px',
          overflow: 'hidden',
        }}
      >
        <button onClick={onToggle} className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3">
            <FolderIcon />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</h2>
                <span className="font-spec text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>{count}</span>
                {isNew > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-light)' }} />
                    <span className="font-spec text-[10px] tracking-widest" style={{ color: 'var(--accent-light)' }}>{isNew} NEW</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <span
            className="transition-transform flex-shrink-0"
            style={{ color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'none' }}
            aria-hidden
          >
            ▾
          </span>
        </button>
        {open && (
          <div>
            {prepend && (
              <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border-accent)' }}>{prepend}</div>
            )}
            {count === 0 ? (
              <div className="px-6 py-6 text-center" style={{ borderTop: '1px solid var(--border-accent)' }}>
                <p className="text-sm" style={{ color: 'var(--text-faint)' }}>{empty}</p>
              </div>
            ) : (
              <div>{children}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AccordionSection({
  title,
  subtitle,
  count,
  isNew,
  open,
  onToggle,
  empty,
  children,
  sectionRef,
  prepend,
}: {
  title: string;
  subtitle: string;
  count: number;
  isNew: number;
  open: boolean;
  onToggle: () => void;
  empty: string;
  children: React.ReactNode;
  sectionRef: React.RefObject<HTMLDivElement | null>;
  prepend?: React.ReactNode;
}) {
  return (
    <div ref={sectionRef} className="card overflow-hidden scroll-mt-24">
      <button onClick={onToggle} className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</h2>
          <span className="font-spec text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>{count}</span>
          {isNew > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-light)' }} />
              <span className="font-spec text-[10px] tracking-widest" style={{ color: 'var(--accent-light)' }}>{isNew} NEW</span>
            </span>
          )}
        </div>
        <span
          className="transition-transform flex-shrink-0"
          style={{ color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div>
          {prepend && (
            <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border-accent)' }}>{prepend}</div>
          )}
          {count === 0 ? (
            <div className="px-6 py-6 text-center" style={{ borderTop: '1px solid var(--border-accent)' }}>
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>{empty}</p>
            </div>
          ) : (
            <div>{children}</div>
          )}
        </div>
      )}
    </div>
  );
}

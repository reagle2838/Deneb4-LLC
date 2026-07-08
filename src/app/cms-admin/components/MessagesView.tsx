'use client';

import type { Client } from '@/lib/clients';
import MessageThread from './MessageThread';

function lastDate(c: Client): string {
  return c.feedback.length ? c.feedback[c.feedback.length - 1].date : '';
}

/** All-clients message inbox, sorted by latest activity. */
export default function MessagesView({
  clients,
  onOpenClient,
}: {
  clients: Client[];
  onOpenClient: (slug: string) => void;
}) {
  const withThreads = clients
    .filter((c) => c.feedback.length > 0)
    .sort((a, b) => lastDate(b).localeCompare(lastDate(a)));

  if (withThreads.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
        No client messages yet. Messages from the portal and staging-site comments land here, and you get an email when they do.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {withThreads.map((c) => (
        <div key={c.slug} className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="font-semibold" style={{ color: 'var(--text-heading)' }}>{c.name}</h3>
            <button onClick={() => onOpenClient(c.slug)} className="text-xs font-spec" style={{ color: 'var(--accent-light)' }}>
              Open command center →
            </button>
          </div>
          <MessageThread slug={c.slug} clientName={c.name} initial={c.feedback} initialDrafts={c.draftReplies} />
        </div>
      ))}
    </div>
  );
}

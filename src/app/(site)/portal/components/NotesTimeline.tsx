import type { ClientRevision, ClientUpdate } from '@/lib/clients';
import { formatFriendlyDate } from '@/lib/format';
import StatusText from './StatusText';

interface TimelineEntry {
  phase: string;
  status: string;
  notes: string;
  date: string;
  kind: 'update' | 'revision';
}

/**
 * "Progress notes": project updates and legacy change requests merged
 * into one chronological story, newest first. Read-only.
 */
export default function NotesTimeline({
  updates,
  revisions,
}: {
  updates: ClientUpdate[];
  revisions: ClientRevision[];
}) {
  const entries: TimelineEntry[] = [
    ...updates.map((u) => ({ phase: u.phase, status: u.status, notes: u.notes, date: u.date, kind: 'update' as const })),
    ...revisions.map((r) => ({ phase: r.phase, status: r.status, notes: r.description, date: r.date, kind: 'revision' as const })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div id="notes" className="card mb-6 scroll-mt-24" style={{ padding: 0 }}>
      <div className="px-6 py-4">
        <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Progress notes</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
          A running record of what has happened on your project, newest first.
        </p>
      </div>
      {entries.length === 0 ? (
        <div className="px-6 py-6 text-center" style={{ borderTop: '1px solid var(--border-accent)' }}>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Notes will appear here as your project moves along.</p>
        </div>
      ) : (
        entries.map((e, i) => (
          <div key={i} className="px-6 py-4 flex gap-4" style={{ borderTop: '1px solid var(--border-accent)' }}>
            <div className="flex flex-col items-center pt-1.5 flex-shrink-0" aria-hidden>
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: e.status === 'complete' ? 'var(--accent)' : 'var(--bg-surface)', border: '2px solid var(--accent)' }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-0.5">
                <p className="font-medium text-sm" style={{ color: 'var(--text-heading)' }}>
                  {e.kind === 'revision' ? `Change request: ${e.phase}` : e.phase}
                </p>
                <StatusText status={e.status} />
                {e.date && <span className="font-spec text-[10px] ml-auto" style={{ color: 'var(--text-faint)' }}>{formatFriendlyDate(e.date)}</span>}
              </div>
              {e.notes && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{e.notes}</p>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

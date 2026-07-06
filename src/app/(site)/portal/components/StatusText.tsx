/**
 * Plain-language status labels for the portal: colored mono text, no
 * pills or badges. One map so every section says things the same way.
 */
const STATUS: Record<string, { label: string; color: string }> = {
  // project updates
  upcoming: { label: 'Coming up', color: 'var(--text-faint)' },
  'in-progress': { label: 'In progress', color: 'var(--accent-light)' },
  'pending-signoff': { label: 'Waiting for your approval', color: '#b45309' },
  complete: { label: 'Done', color: '#15803d' },
  // legacy revisions
  requested: { label: 'Requested', color: '#b45309' },
  // invoices
  pending: { label: 'Due', color: '#b45309' },
  paid: { label: 'Paid', color: '#15803d' },
  overdue: { label: 'Past due', color: '#e40014' },
  // preview site
  building: { label: 'Being built', color: 'var(--text-faint)' },
  ready: { label: 'Ready for you to look at', color: 'var(--accent-light)' },
  live: { label: 'Live on the internet', color: '#15803d' },
  down: { label: 'Temporarily offline for updates', color: '#b45309' },
};

export default function StatusText({ status, className = '' }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, color: 'var(--text-faint)' };
  return (
    <span
      className={`font-spec text-[11px] tracking-widest uppercase ${className}`.trim()}
      style={{ color: s.color }}
    >
      {s.label}
    </span>
  );
}

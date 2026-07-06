'use client';

/**
 * The first thing a client reads: one plain sentence about what is
 * happening and whether anything is needed from them.
 */
export default function NextStepBanner({
  pendingApprovals,
  unreadMessages,
  stageSummary,
}: {
  pendingApprovals: number;
  unreadMessages: number;
  stageSummary: string;
}) {
  let heading = 'Nothing is needed from you right now.';
  let body = stageSummary || 'We are on it. Check back any time to see progress.';
  let action: { label: string; target: string } | null = null;

  if (pendingApprovals > 0) {
    heading = pendingApprovals === 1 ? 'One thing needs your approval.' : `${pendingApprovals} things need your approval.`;
    body = 'Take a look below and press Approve when you are happy, or send us a question first.';
    action = { label: 'Review and approve', target: 'approvals' };
  } else if (unreadMessages > 0) {
    heading = unreadMessages === 1 ? 'You have a new message.' : `You have ${unreadMessages} new messages.`;
    body = 'Deneb4 wrote to you. Read it below and reply whenever suits you.';
    action = { label: 'Read messages', target: 'messages' };
  } else if (stageSummary) {
    heading = 'Your project is moving.';
  }

  function jump(target: string) {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="card accent-banner p-6 mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-spec text-[11px] tracking-widest uppercase mb-1" style={{ color: 'var(--accent-light)' }}>
          What&apos;s happening now
        </p>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-heading)' }}>{heading}</h2>
        <p className="text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--text-muted)' }}>{body}</p>
      </div>
      {action && (
        <button onClick={() => jump(action.target)} className="btn-primary flex-shrink-0">
          {action.label}
        </button>
      )}
    </div>
  );
}

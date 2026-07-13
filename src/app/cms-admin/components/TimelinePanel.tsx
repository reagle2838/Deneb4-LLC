'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The unified communications timeline: every message, email (with its
 * actual content), consultation summary, sent invoice, and agent ledger
 * entry for this client, newest first, in one place. Internal-only view —
 * it includes drafts and agent alerts the client never sees.
 */

interface TimelineItem {
  date: string;
  source: 'message' | 'draft' | 'email' | 'consultation' | 'invoice' | 'ledger';
  from: string;
  title: string;
  detail: string;
  meta?: string;
}

const SOURCE_STYLE: Record<TimelineItem['source'], { label: string; color: string }> = {
  message: { label: 'MSG', color: 'var(--accent-light)' },
  draft: { label: 'DRAFT', color: '#b45309' },
  email: { label: 'EMAIL', color: 'var(--text-muted)' },
  consultation: { label: 'CALL', color: '#7c3aed' },
  invoice: { label: 'INV', color: '#15803d' },
  ledger: { label: 'AGENT', color: 'var(--text-faint)' },
};

const INITIAL_SHOWN = 12;

export default function TimelinePanel({ slug }: { slug: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [hideAgents, setHideAgents] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/timeline?slug=${encodeURIComponent(slug)}`);
      const data = (await res.json()) as { ok?: boolean; items?: TimelineItem[] };
      if (data.ok) setItems(data.items ?? []);
    } catch {
      /* best-effort */
    } finally {
      setLoaded(true);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = hideAgents ? items.filter((i) => i.source !== 'ledger') : items;
  const shown = showAll ? filtered : filtered.slice(0, INITIAL_SHOWN);
  if (loaded && items.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Timeline — everything on this project
        </h3>
        <label className="flex items-center gap-1.5 text-[10px] font-spec" style={{ color: 'var(--text-faint)' }}>
          <input type="checkbox" checked={hideAgents} onChange={(e) => setHideAgents(e.target.checked)} />
          hide agent activity
        </label>
      </div>

      <div className="space-y-2">
        {shown.map((item, i) => {
          const s = SOURCE_STYLE[item.source];
          const isOpen = expanded === i;
          const truncated = item.detail.length > 160;
          return (
            <div key={`${item.date}-${i}`} className="flex gap-2.5 text-xs" style={{ borderLeft: `2px solid ${s.color}`, paddingLeft: '0.6rem' }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-spec text-[9px] tracking-widest" style={{ color: s.color }}>{s.label}</span>
                  <span style={{ color: 'var(--text-heading)' }}>{item.title}</span>
                  <span className="font-spec text-[10px]" style={{ color: 'var(--text-faint)' }}>
                    {item.from} · {new Date(item.date).toLocaleString()} {item.meta ? `· ${item.meta}` : ''}
                  </span>
                </div>
                {item.detail !== item.title && (
                  <p
                    className={truncated && !isOpen ? 'cursor-pointer' : undefined}
                    style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}
                    onClick={() => truncated && setExpanded(isOpen ? null : i)}
                    title={truncated && !isOpen ? 'Click to expand' : undefined}
                  >
                    {truncated && !isOpen ? `${item.detail.slice(0, 157)}...` : item.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > INITIAL_SHOWN && (
        <button onClick={() => setShowAll((s) => !s)} className="btn-outline text-xs mt-3">
          {showAll ? 'Show recent only' : `Show all ${filtered.length} entries`}
        </button>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { QuickLink } from '@/lib/quick-links';

const NAV_ID = 'cms-workspace-nav';
const NAV_LABEL_ID = 'cms-biz-label';
const ZONE_ID = 'cms-biz-zone';

function onDashboard(): boolean {
  return /\/keystatic\/?$/.test(window.location.pathname);
}

function dashboardHeading(): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('h1,h2')).find(
      (h) => h.textContent?.trim() === 'Dashboard' && !h.closest('nav')
    ) ?? null
  );
}

function normHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const ICON_OPTIONS = [
  '🔗', '🌐', '📁', '🗂️', '📄', '📊', '📈', '📅', '📧', '💬',
  '🎨', '🛠️', '⚙️', '💳', '✅', '🔍', '☁️', '🤖', '📷', '🔑',
  '📝', '💡', '🚀', '⭐', '📌', '🧰', '🖥️', '📦', '🔔', '🏦',
];

export default function KeystaticClientManager({
  activeClients,
  quickLinks,
}: {
  activeClients: number;
  quickLinks: QuickLink[];
}) {
  const [open, setOpen] = useState(false);
  const [qlOpen, setQlOpen] = useState(false);
  const [links, setLinks] = useState<QuickLink[]>(quickLinks);
  const [draft, setDraft] = useState<QuickLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [iconPicker, setIconPicker] = useState<number | null>(null);

  const linksRef = useRef<QuickLink[]>(quickLinks);
  const activeRef = useRef(activeClients);
  linksRef.current = links;
  activeRef.current = activeClients;

  function openEditor() {
    const cur = linksRef.current;
    setDraft(cur.length ? cur.map((l) => ({ ...l })) : [{ label: '', url: '', icon: '🔗' }]);
    setError('');
    setIconPicker(null);
    setQlOpen(true);
  }

  // Inject the Business Operations sidebar group + dashboard zone, re-running
  // on an interval so they survive Keystatic re-renders.
  useEffect(() => {
    function card(): HTMLDivElement {
      const d = document.createElement('div');
      d.style.cssText = 'background:#fff;border:1px solid rgba(15,23,42,0.12);border-radius:8px;';
      return d;
    }

    function sectionLabel(text: string): HTMLParagraphElement {
      const p = document.createElement('p');
      p.textContent = text;
      p.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin:0 0 10px;';
      return p;
    }

    function injectSidebarGroup() {
      const dash = document.querySelector<HTMLAnchorElement>('a[href$="/keystatic"]');
      const nav = dash?.closest('nav');
      if (!nav || !dash) return;

      let label = document.getElementById(NAV_LABEL_ID);
      if (!label) {
        label = document.createElement('div');
        label.id = NAV_LABEL_ID;
        label.textContent = 'Business Operations';
        label.style.cssText = 'padding:16px 12px 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;';
      }
      let btn = document.getElementById(NAV_ID) as HTMLButtonElement | null;
      if (!btn) {
        btn = document.createElement('button');
        btn.id = NAV_ID;
        btn.type = 'button';
        btn.textContent = 'Workspace';
        btn.style.cssText = [
          'display:block', 'width:calc(100% - 24px)', 'margin:0 12px 6px', 'padding:9px 12px',
          'border-radius:6px', 'background:#006b8f', 'color:#ffffff', 'font-size:14px',
          'font-weight:600', 'text-align:left', 'border:none', 'cursor:pointer',
        ].join(';');
        btn.addEventListener('mouseenter', () => { if (btn) btn.style.background = '#00546f'; });
        btn.addEventListener('mouseleave', () => { if (btn) btn.style.background = '#006b8f'; });
        btn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('open-workspace')));
      }
      // Place label + button at the end of the sidebar nav.
      if (label.parentElement !== nav || nav.lastElementChild !== btn) {
        nav.appendChild(label);
        nav.appendChild(btn);
      }
    }

    function injectZone() {
      if (!onDashboard()) {
        document.getElementById(ZONE_ID)?.remove();
        return;
      }
      const heading = dashboardHeading();
      if (!heading || !heading.parentElement) return;

      const cur = linksRef.current;
      const n = activeRef.current;
      const sig = JSON.stringify({ cur, n });
      let zone = document.getElementById(ZONE_ID) as HTMLDivElement | null;
      if (zone && zone.dataset.sig === sig && zone.isConnected) return;

      if (!zone) {
        zone = document.createElement('div');
        zone.id = ZONE_ID;
        zone.style.cssText = 'margin-top:36px;';
      }
      zone.dataset.sig = sig;
      zone.innerHTML = '';
      zone.appendChild(sectionLabel('Business Operations'));

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;align-items:stretch;';

      // Workspace launcher
      const ws = document.createElement('button');
      ws.type = 'button';
      ws.style.cssText =
        'background:#fff;border:1px solid rgba(15,23,42,0.12);border-radius:8px;padding:16px 20px;cursor:pointer;text-align:left;min-width:200px;';
      ws.innerHTML =
        '<p style="margin:0;font-size:15px;font-weight:600;color:#0f172a">Open Workspace →</p>' +
        '<p style="margin:4px 0 0;font-size:12px;color:#64748b">Clients · Leads · Tasks · Notes</p>';
      ws.addEventListener('click', () => window.dispatchEvent(new CustomEvent('open-workspace')));
      row.appendChild(ws);

      // Active clients counter
      const counter = card();
      counter.style.cssText += 'padding:16px 20px;display:flex;flex-direction:column;justify-content:center;min-width:130px;';
      counter.innerHTML =
        `<span style="font-size:28px;font-weight:700;line-height:1;color:#006b8f">${n}</span>` +
        `<span style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:#64748b;margin-top:4px">${n === 1 ? 'ACTIVE CLIENT' : 'ACTIVE CLIENTS'}</span>`;
      row.appendChild(counter);

      // Quick links
      const ql = card();
      ql.style.cssText += 'padding:14px 16px;flex:1;min-width:240px;';
      const qlHead = document.createElement('div');
      qlHead.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
      qlHead.innerHTML = '<span style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#64748b">QUICK LINKS</span>';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = cur.length ? 'Edit' : '+ Add';
      editBtn.style.cssText = 'font-size:12px;font-weight:600;color:#006b8f;background:none;border:none;cursor:pointer;';
      editBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('open-quick-links')));
      qlHead.appendChild(editBtn);
      ql.appendChild(qlHead);

      const chips = document.createElement('div');
      chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;max-height:120px;overflow-y:auto;';
      if (cur.length === 0) {
        const empty = document.createElement('span');
        empty.textContent = 'No quick links yet.';
        empty.style.cssText = 'font-size:13px;color:#94a3b8;';
        chips.appendChild(empty);
      } else {
        for (const l of cur) {
          const a = document.createElement('a');
          a.href = normHref(l.url);
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.innerHTML = `<span style="margin-right:6px">${l.icon || '🔗'}</span>${l.label || l.url}`;
          a.style.cssText =
            'display:inline-flex;align-items:center;font-size:13px;padding:5px 10px;border:1px solid rgba(15,23,42,0.12);border-radius:6px;background:#fff;color:#18222e;text-decoration:none;';
          chips.appendChild(a);
        }
      }
      ql.appendChild(chips);
      row.appendChild(ql);

      zone.appendChild(row);
      heading.parentElement.appendChild(zone);
    }

    function tick() {
      injectSidebarGroup();
      injectZone();
    }

    tick();
    const interval = window.setInterval(tick, 300);
    const onWs = () => setOpen(true);
    const onQl = () => openEditor();
    window.addEventListener('open-workspace', onWs);
    window.addEventListener('open-quick-links', onQl);
    return () => {
      window.clearInterval(interval);
      document.getElementById(NAV_ID)?.remove();
      document.getElementById(NAV_LABEL_ID)?.remove();
      document.getElementById(ZONE_ID)?.remove();
      window.removeEventListener('open-workspace', onWs);
      window.removeEventListener('open-quick-links', onQl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setQlOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function saveQuickLinks() {
    setBusy(true);
    setError('');
    const clean = draft.map((l) => ({ label: l.label.trim(), url: l.url.trim(), icon: l.icon || '🔗' })).filter((l) => l.url);
    try {
      const res = await fetch('/api/quick-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: clean }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setLinks(clean);
        setQlOpen(false);
      } else {
        setError(data.error ?? 'Failed to save.');
      }
    } catch {
      setError('Server error — try again.');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a',
    borderRadius: '6px', padding: '8px 10px', fontSize: '14px', outline: 'none',
  };

  return (
    <>
      {/* Workspace modal */}
      {open && (
        <ModalShell title="Workspace" onClose={() => setOpen(false)}>
          <iframe src="/cms-admin" title="Workspace" style={{ flex: 1, width: '100%', border: 'none' }} />
        </ModalShell>
      )}

      {/* Quick Links editor modal */}
      {qlOpen && (
        <ModalShell title="Quick Links" onClose={() => setQlOpen(false)} compact>
          <div style={{ padding: '18px', overflowY: 'auto' }}>
            {error && <p style={{ color: '#e40014', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {draft.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setIconPicker((p) => (p === i ? null : i))}
                    style={{ ...inputStyle, width: '44px', flexShrink: 0, cursor: 'pointer', fontSize: '18px', textAlign: 'center', padding: '6px 0' }}
                    aria-label="Choose icon"
                  >
                    {l.icon || '🔗'}
                  </button>
                  {iconPicker === i && (
                    <>
                      <div onClick={() => setIconPicker(null)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
                      <div style={{ position: 'absolute', top: '46px', left: 0, zIndex: 2, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 10px 24px rgba(0,0,0,0.16)', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '2px', width: '232px' }}>
                        {ICON_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, icon: emoji } : x)));
                              setIconPicker(null);
                            }}
                            style={{ fontSize: '18px', padding: '6px', border: 'none', background: l.icon === emoji ? '#e2e8f0' : 'transparent', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <input
                    value={l.label}
                    onChange={(e) => setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                    placeholder="Label"
                    style={{ ...inputStyle, width: '140px', flexShrink: 0 }}
                  />
                  <input
                    value={l.url}
                    onChange={(e) => setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))}
                    placeholder="https://..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setDraft((d) => d.filter((_, idx) => idx !== i))}
                    style={{ color: '#e40014', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDraft((d) => [...d, { label: '', url: '', icon: '🔗' }])}
              style={{ marginTop: '10px', fontSize: '13px', color: '#006b8f', background: 'none', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer', fontWeight: 600 }}
            >
              + Add link
            </button>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button type="button" onClick={() => setQlOpen(false)} disabled={busy} style={{ fontSize: '14px', padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={saveQuickLinks} disabled={busy} style={{ fontSize: '14px', padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#006b8f', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  compact,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: compact ? '640px' : '1100px',
          height: compact ? 'auto' : '90vh',
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: '10px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '22px', lineHeight: 1, cursor: 'pointer', color: '#475569' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

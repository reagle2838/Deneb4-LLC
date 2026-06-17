'use client';

import { useEffect, useRef, useState } from 'react';
import type { QuickLink } from '@/lib/quick-links';

const NAV_ID = 'cms-client-manager-nav';
const COUNTER_ID = 'cms-active-client-counter';

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
  const [qlMenu, setQlMenu] = useState(false);
  const [isDash, setIsDash] = useState(false);
  const [links, setLinks] = useState<QuickLink[]>(quickLinks);
  const [draft, setDraft] = useState<QuickLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [iconPicker, setIconPicker] = useState<number | null>(null);
  const activeRef = useRef(activeClients);
  activeRef.current = activeClients;

  // Inject the sidebar CTA + active-client counter into the dashboard, and
  // track whether we're on the dashboard (for the quick-links widget).
  useEffect(() => {
    function injectCounter() {
      if (!onDashboard()) {
        document.getElementById(COUNTER_ID)?.remove();
        return;
      }
      if (document.getElementById(COUNTER_ID)) return;
      const heading = dashboardHeading();
      if (!heading || !heading.parentElement) return;

      const box = document.createElement('div');
      box.id = COUNTER_ID;
      box.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:12px',
        'background:#ffffff',
        'border:1px solid rgba(15,23,42,0.12)',
        'border-radius:8px',
        'padding:12px 20px',
        'margin:16px 0 4px',
      ].join(';');
      const n = activeRef.current;
      const label = n === 1 ? 'ACTIVE CLIENT' : 'ACTIVE CLIENTS';
      box.innerHTML =
        `<span style="font-size:28px;font-weight:700;line-height:1;color:#006b8f">${n}</span>` +
        `<span style="font-size:12px;font-weight:600;letter-spacing:0.08em;color:#64748b">${label}</span>`;
      heading.parentElement.insertBefore(box, heading.nextSibling);
    }

    function injectSidebarCta() {
      const dash = document.querySelector<HTMLAnchorElement>('a[href$="/keystatic"]');
      const nav = dash?.closest('nav');
      if (!nav || !dash) return;

      let btn = document.getElementById(NAV_ID) as HTMLButtonElement | null;
      if (!btn) {
        btn = document.createElement('button');
        btn.id = NAV_ID;
        btn.type = 'button';
        btn.textContent = 'Workspace';
        btn.style.cssText = [
          'display:block',
          'width:calc(100% - 24px)',
          'margin:6px 12px',
          'padding:9px 12px',
          'border-radius:6px',
          'background:#006b8f',
          'color:#ffffff',
          'font-size:14px',
          'font-weight:600',
          'text-align:left',
          'border:none',
          'cursor:pointer',
        ].join(';');
        btn.addEventListener('mouseenter', () => { if (btn) btn.style.background = '#00546f'; });
        btn.addEventListener('mouseleave', () => { if (btn) btn.style.background = '#006b8f'; });
        btn.addEventListener('click', () => setOpen(true));
      }
      const dashItem = Array.from(nav.children).find((c) => c.contains(dash)) ?? dash;
      if (btn.previousElementSibling !== dashItem) {
        nav.insertBefore(btn, dashItem.nextSibling);
      }
    }

    function tick() {
      setIsDash(onDashboard());
      injectCounter();
      injectSidebarCta();
    }

    tick();
    const interval = window.setInterval(tick, 300);
    return () => {
      window.clearInterval(interval);
      document.getElementById(NAV_ID)?.remove();
      document.getElementById(COUNTER_ID)?.remove();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setQlOpen(false);
        setQlMenu(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function openEditor() {
    setDraft(links.length ? links.map((l) => ({ ...l })) : [{ label: '', url: '', icon: '🔗' }]);
    setError('');
    setIconPicker(null);
    setQlMenu(false);
    setQlOpen(true);
  }

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
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '14px',
    outline: 'none',
  };

  return (
    <>
      {/* Quick Links — fixed dropdown on the right */}
      {isDash && (
        <div style={{ position: 'fixed', top: '14px', right: '20px', zIndex: 60 }}>
          <button
            type="button"
            onClick={() => setQlMenu((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#fff',
              border: '1px solid rgba(15,23,42,0.15)',
              borderRadius: '8px',
              padding: '9px 14px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0f172a',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            Quick Links
            <span style={{ color: '#64748b', transform: qlMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
          </button>

          {qlMenu && (
            <>
              <div onClick={() => setQlMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 59 }} />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  marginTop: '8px',
                  width: '280px',
                  background: '#fff',
                  border: '1px solid rgba(15,23,42,0.12)',
                  borderRadius: '10px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                  zIndex: 61,
                  overflow: 'hidden',
                }}
              >
                <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px' }}>
                  {links.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#94a3b8', padding: '12px', textAlign: 'center' }}>No quick links yet.</p>
                  ) : (
                    links.map((l, i) => (
                      <a
                        key={i}
                        href={normHref(l.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 12px',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#0f172a',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontSize: '16px', lineHeight: 1 }}>{l.icon || '🔗'}</span>
                        <span>{l.label || l.url}</span>
                      </a>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={openEditor}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    border: 'none',
                    borderBottomLeftRadius: '10px',
                    borderBottomRightRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#006b8f',
                    cursor: 'pointer',
                  }}
                >
                  {links.length ? 'Edit links' : '+ Add quick links'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Client Manager modal */}
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
                      <div
                        style={{
                          position: 'absolute',
                          top: '46px',
                          left: 0,
                          zIndex: 2,
                          background: '#fff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
                          padding: '8px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(6, 1fr)',
                          gap: '2px',
                          width: '232px',
                        }}
                      >
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
              <button
                type="button"
                onClick={() => setQlOpen(false)}
                disabled={busy}
                style={{ fontSize: '14px', padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveQuickLinks}
                disabled={busy}
                style={{ fontSize: '14px', padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#006b8f', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                {busy ? 'Saving...' : 'Save'}
              </button>
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '22px', lineHeight: 1, cursor: 'pointer', color: '#475569' }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

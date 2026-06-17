'use client';

import { useEffect, useState } from 'react';

const NAV_ID = 'cms-client-manager-nav';
const COUNTER_ID = 'cms-active-client-counter';

function onDashboard(): boolean {
  return /\/keystatic\/?$/.test(window.location.pathname);
}

export default function KeystaticClientManager({ activeClients }: { activeClients: number }) {
  const [open, setOpen] = useState(false);

  // Insert a blue "Client Manager" CTA into the sidebar (left column),
  // right below the Dashboard link, plus an active-client counter at the
  // top of the dashboard. Re-inject on an interval so both survive
  // Keystatic re-renders.
  useEffect(() => {
    function injectCounter() {
      if (!onDashboard()) {
        document.getElementById(COUNTER_ID)?.remove();
        return;
      }
      if (document.getElementById(COUNTER_ID)) return;
      const heading = Array.from(document.querySelectorAll<HTMLElement>('h1,h2')).find(
        (h) => h.textContent?.trim() === 'Dashboard' && !h.closest('nav')
      );
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
      const label = activeClients === 1 ? 'ACTIVE CLIENT' : 'ACTIVE CLIENTS';
      box.innerHTML =
        `<span style="font-size:28px;font-weight:700;line-height:1;color:#006b8f">${activeClients}</span>` +
        `<span style="font-size:12px;font-weight:600;letter-spacing:0.08em;color:#64748b">${label}</span>`;
      heading.parentElement.insertBefore(box, heading.nextSibling);
    }

    function inject() {
      injectCounter();
      const dash = document.querySelector<HTMLAnchorElement>('a[href$="/keystatic"]');
      const nav = dash?.closest('nav');
      if (!nav || !dash) return;

      let btn = document.getElementById(NAV_ID) as HTMLButtonElement | null;
      if (!btn) {
        btn = document.createElement('button');
        btn.id = NAV_ID;
        btn.type = 'button';
        btn.textContent = 'Client Manager';
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

      // Place it as a direct nav child right after the Dashboard item.
      const dashItem = Array.from(nav.children).find((c) => c.contains(dash)) ?? dash;
      if (btn.previousElementSibling !== dashItem) {
        nav.insertBefore(btn, dashItem.nextSibling);
      }
    }

    inject();
    const interval = window.setInterval(inject, 300);
    return () => {
      window.clearInterval(interval);
      document.getElementById(NAV_ID)?.remove();
      document.getElementById(COUNTER_ID)?.remove();
    };
  }, [activeClients]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1100px',
          height: '90vh',
          background: '#fff',
          borderRadius: '10px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid #e2e8f0',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Client Manager</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '22px', lineHeight: 1, cursor: 'pointer', color: '#475569' }}
          >
            ×
          </button>
        </div>
        <iframe src="/cms-admin" title="Client Manager" style={{ flex: 1, width: '100%', border: 'none' }} />
      </div>
    </div>
  );
}

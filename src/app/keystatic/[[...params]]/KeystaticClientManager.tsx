'use client';

import { useEffect, useState } from 'react';

const NAV_ID = 'cms-workspace-nav';
const NAV_LABEL_ID = 'cms-biz-label';

export default function KeystaticClientManager() {
  const [open, setOpen] = useState(false);

  // Add a "Business Operations" group (label + Workspace button) to the
  // sidebar, placed right after the Content Management nav items. Re-runs on
  // an interval so it survives Keystatic re-renders.
  useEffect(() => {
    function inject() {
      const dash = document.querySelector<HTMLAnchorElement>('a[href$="/keystatic"]');
      const nav = dash?.closest('nav');
      if (!nav) return;

      // The anchor point is the last Content nav item (collection/singleton).
      const contentLinks = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href*="/keystatic/"]'));
      const lastLink = contentLinks[contentLinks.length - 1];
      const anchorItem = lastLink
        ? (Array.from(nav.children).find((c) => c.contains(lastLink)) ?? lastLink)
        : null;
      if (!anchorItem) return;

      let label = document.getElementById(NAV_LABEL_ID);
      if (!label) {
        label = document.createElement('div');
        label.id = NAV_LABEL_ID;
        label.textContent = 'Business Operations';
        label.style.cssText = 'padding:20px 12px 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;';
      }
      let btn = document.getElementById(NAV_ID) as HTMLButtonElement | null;
      if (!btn) {
        btn = document.createElement('button');
        btn.id = NAV_ID;
        btn.type = 'button';
        btn.textContent = 'Workspace';
        btn.style.cssText = [
          'display:block', 'width:calc(100% - 24px)', 'margin:0 12px', 'padding:9px 12px',
          'border-radius:6px', 'background:#006b8f', 'color:#ffffff', 'font-size:14px',
          'font-weight:600', 'text-align:left', 'border:none', 'cursor:pointer',
        ].join(';');
        btn.addEventListener('mouseenter', () => { if (btn) btn.style.background = '#00546f'; });
        btn.addEventListener('mouseleave', () => { if (btn) btn.style.background = '#006b8f'; });
        btn.addEventListener('click', () => setOpen(true));
      }

      // Insert label then button right after the last content item.
      if (label.previousElementSibling !== anchorItem) {
        nav.insertBefore(label, anchorItem.nextSibling);
      }
      if (btn.previousElementSibling !== label) {
        nav.insertBefore(btn, label.nextSibling);
      }
    }

    inject();
    const interval = window.setInterval(inject, 300);
    return () => {
      window.clearInterval(interval);
      document.getElementById(NAV_ID)?.remove();
      document.getElementById(NAV_LABEL_ID)?.remove();
    };
  }, []);

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
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '1100px', height: '90vh', background: '#fff', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Workspace</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '22px', lineHeight: 1, cursor: 'pointer', color: '#475569' }}>×</button>
        </div>
        <iframe src="/cms-admin" title="Workspace" style={{ flex: 1, width: '100%', border: 'none' }} />
      </div>
    </div>
  );
}

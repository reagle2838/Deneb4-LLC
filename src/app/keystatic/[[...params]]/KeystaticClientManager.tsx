'use client';

import { useEffect, useState } from 'react';

const NAV_BUTTON_ID = 'cms-client-manager-nav';

export default function KeystaticClientManager() {
  const [open, setOpen] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  // Inject a "Client Manager" button into the Keystatic sidebar nav.
  useEffect(() => {
    function inject() {
      if (document.getElementById(NAV_BUTTON_ID)) return;
      const navLink = document.querySelector(
        'a[href*="/keystatic/collection"], a[href*="/keystatic/singleton"], a[href$="/keystatic"]'
      );
      const nav = navLink?.closest('nav') ?? navLink?.parentElement;
      if (!nav) return;

      const btn = document.createElement('button');
      btn.id = NAV_BUTTON_ID;
      btn.type = 'button';
      btn.textContent = 'Client Manager';
      btn.style.cssText =
        'display:block;width:calc(100% - 16px);text-align:left;padding:8px 12px;margin:8px;border-radius:6px;background:#006b8f;color:#fff;font-size:14px;font-weight:600;border:none;cursor:pointer;';
      btn.addEventListener('click', () =>
        window.dispatchEvent(new CustomEvent('open-client-manager'))
      );
      nav.appendChild(btn);
    }

    inject();
    const observer = new MutationObserver(() => inject());
    observer.observe(document.body, { childList: true, subtree: true });

    const onOpen = () => setOpen(true);
    window.addEventListener('open-client-manager', onOpen);

    // If the sidebar markup ever changes and injection fails, show a
    // fixed fallback button so this is never inaccessible.
    const t = setTimeout(() => {
      if (!document.getElementById(NAV_BUTTON_ID)) setShowFallback(true);
    }, 2500);

    return () => {
      observer.disconnect();
      window.removeEventListener('open-client-manager', onOpen);
      clearTimeout(t);
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {showFallback && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            right: '20px',
            bottom: '20px',
            zIndex: 1000,
            padding: '10px 16px',
            borderRadius: '6px',
            background: '#006b8f',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          }}
        >
          Client Manager
        </button>
      )}

      {open && (
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
      )}
    </>
  );
}

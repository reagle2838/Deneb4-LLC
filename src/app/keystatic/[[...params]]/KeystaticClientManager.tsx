'use client';

import { useEffect, useState } from 'react';

const CARD_ID = 'cms-client-manager-card';

function onDashboard(): boolean {
  return /\/keystatic\/?$/.test(window.location.pathname);
}

// Set the first meaningful text node to `text`, clear the rest. Keeps any
// icon/structure intact so the clone matches the other cards exactly.
function relabel(node: HTMLElement, text: string) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  let done = false;
  for (const n of textNodes) {
    if (n.textContent && n.textContent.trim()) {
      if (!done) {
        n.textContent = text;
        done = true;
      } else {
        n.textContent = '';
      }
    }
  }
  if (!done) node.textContent = text;
}

export default function KeystaticClientManager() {
  const [open, setOpen] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    function inject() {
      if (!onDashboard()) return;
      if (document.getElementById(CARD_ID)) return;

      // Dashboard cards are links to collections/singletons that live in the
      // main content area (not the sidebar <nav>).
      const cards = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'a[href*="/keystatic/collection"], a[href*="/keystatic/singleton"]'
        )
      ).filter((a) => !a.closest('nav'));

      const template = cards[0];
      if (!template) return;

      const clone = template.cloneNode(true) as HTMLAnchorElement;
      clone.id = CARD_ID;
      clone.setAttribute('href', '#');
      relabel(clone, 'Client Manager');
      clone.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-client-manager'));
      });

      template.parentElement?.appendChild(clone);
    }

    inject();
    const observer = new MutationObserver(() => inject());
    observer.observe(document.body, { childList: true, subtree: true });

    const onOpen = () => setOpen(true);
    window.addEventListener('open-client-manager', onOpen);

    const t = setTimeout(() => {
      if (onDashboard() && !document.getElementById(CARD_ID)) setShowFallback(true);
    }, 2500);

    return () => {
      observer.disconnect();
      window.removeEventListener('open-client-manager', onOpen);
      clearTimeout(t);
    };
  }, []);

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

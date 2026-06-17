'use client';

import { useEffect, useState } from 'react';

const CARD_ID = 'cms-client-manager-card';

function onDashboard(): boolean {
  return /\/keystatic\/?$/.test(window.location.pathname);
}

// A leaf element whose exact text equals `text` (e.g. the "LEGAL" label).
function leafWithText(text: string): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,p,span,div,strong');
  for (const el of els) {
    if (el.textContent?.trim() === text && el.querySelectorAll('*').length === 0) return el;
  }
  return null;
}

function commonAncestor(a: HTMLElement, b: HTMLElement): HTMLElement | null {
  const seen = new Set<HTMLElement>();
  let x: HTMLElement | null = a;
  while (x) { seen.add(x); x = x.parentElement; }
  let y: HTMLElement | null = b;
  while (y) { if (seen.has(y)) return y; y = y.parentElement; }
  return null;
}

// Relabel a cloned card: the title is the longest text node (e.g.
// "Articles & Insights"); set it to `text` and clear any other text
// (counts, descriptions) so only one clean label remains. Keeps the
// icon/structure intact so the clone matches the other cards exactly.
function relabel(node: HTMLElement, text: string) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (n.textContent && n.textContent.trim()) textNodes.push(n);
  }
  if (textNodes.length === 0) {
    node.textContent = text;
    return;
  }
  textNodes.sort((a, b) => (b.textContent ?? '').trim().length - (a.textContent ?? '').trim().length);
  textNodes[0].textContent = text;
  for (let i = 1; i < textNodes.length; i++) textNodes[i].textContent = '';
  // Avoid a stale tooltip showing the old collection name.
  node.removeAttribute('title');
  node.querySelectorAll('[title],[aria-label]').forEach((el) => {
    el.removeAttribute('title');
    el.removeAttribute('aria-label');
  });
}

export default function KeystaticClientManager() {
  const [open, setOpen] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    function inject() {
      if (!onDashboard()) return;
      if (document.getElementById(CARD_ID)) return;

      // Singleton cards (Privacy Policy / Terms) are clean cards: just a
      // title, no "+ create" button or entry count. Use one as the template.
      const cardTemplate = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/keystatic/singleton"]')
      ).find((a) => !a.closest('nav'));
      const cardsRow = cardTemplate?.parentElement;
      if (!cardTemplate || !cardsRow) return;

      // Find where to drop a new section: the container holding the
      // CONTENT and LEGAL section labels.
      const contentLabel = leafWithText('CONTENT');
      const legalLabel = leafWithText('LEGAL');
      const container =
        contentLabel && legalLabel
          ? commonAncestor(contentLabel, legalLabel)
          : cardsRow.parentElement;
      if (!container) return;

      // The card: clone a clean singleton card, relabel, open the modal.
      const card = cardTemplate.cloneNode(true) as HTMLElement;
      card.setAttribute('href', '#');
      relabel(card, 'Client Manager');
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-client-manager'));
      });

      // A row container matching the singleton cards row (empty shallow clone).
      const row = cardsRow.cloneNode(false) as HTMLElement;
      row.appendChild(card);

      const wrapper = document.createElement('div');
      wrapper.id = CARD_ID;
      if (legalLabel) {
        const label = legalLabel.cloneNode(true) as HTMLElement;
        label.textContent = 'CLIENT';
        wrapper.appendChild(label);
      }
      wrapper.appendChild(row);
      container.appendChild(wrapper);
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

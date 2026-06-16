"use client";

import { useState } from "react";

export interface Faq {
  q: string;
  a: string;
}

export default function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="max-w-3xl" style={{ borderTop: "1px solid var(--border-accent)" }}>
      {faqs.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderBottom: "1px solid var(--border-accent)" }}>
            <button
              className="w-full flex items-start justify-between gap-6 py-5 text-left"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span className="text-base font-semibold" style={{ color: "var(--text-heading)" }}>{faq.q}</span>
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5 transition-transform duration-200"
                style={{ transform: isOpen ? "rotate(45deg)" : undefined, color: "var(--accent-light)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
              </svg>
            </button>
            {isOpen && (
              <p className="text-sm leading-relaxed pb-5 pr-10" style={{ color: "var(--text-muted)" }}>{faq.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

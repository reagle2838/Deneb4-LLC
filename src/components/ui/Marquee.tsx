"use client";

import { TECH_STACK } from "@/data/nav";

export default function Marquee() {
  const items = [...TECH_STACK, ...TECH_STACK];
  return (
    <div
      className="marquee-outer bg-theme-alt py-5"
      style={{ borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)" }}
      aria-label="Technologies and standards Deneb4 builds with"
    >
      <div className="marquee-inner">
        {items.map((item, i) => (
          <span key={i} className="flex items-center flex-shrink-0">
            <span className="font-spec text-sm px-8" style={{ color: "var(--text-muted)" }}>{item}</span>
            <span style={{ color: "var(--accent)" }} aria-hidden="true">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

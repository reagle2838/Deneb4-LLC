"use client";

export default function Marquee() {
  return (
    <div
      className="marquee-outer bg-theme-alt py-5"
      style={{ borderTop: "1px solid var(--border-accent)", borderBottom: "1px solid var(--border-accent)", minHeight: "61px" }}
      aria-hidden="true"
    >
      <div className="marquee-inner" />
    </div>
  );
}

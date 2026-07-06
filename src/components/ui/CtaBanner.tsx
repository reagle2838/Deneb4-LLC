import Link from "next/link";
import type { ReactNode } from "react";
import Magnetic from "@/components/motion/Magnetic";

interface CtaLink {
  href: string;
  label: string;
}

interface CtaBannerProps {
  /** Heading; pass accent spans inline for the alternating-color effect. */
  title: ReactNode;
  body?: ReactNode;
  primary: CtaLink;
  secondary?: CtaLink;
  /** Small mono footnote under the body ("hello@deneb4.com · Mon-Fri ..."). */
  footnote?: string;
  variant?: "banner" | "centered";
}

/**
 * Shared end-of-page call to action. One component, per-page copy,
 * so the closing pitch never reads identically on two pages.
 */
export default function CtaBanner({
  title,
  body,
  primary,
  secondary,
  footnote,
  variant = "banner",
}: CtaBannerProps) {
  if (variant === "centered") {
    return (
      <div
        className="card p-10 sm:p-14 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(0,107,143,0.10) 0%, var(--bg-surface) 100%)",
          borderTop: "3px solid var(--accent)",
        }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">{title}</h2>
        {body && (
          <p className="text-sm sm:text-base leading-relaxed max-w-xl mx-auto mb-6" style={{ color: "var(--text-muted)" }}>
            {body}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Magnetic>
            <Link href={primary.href} className="btn-primary">{primary.label}</Link>
          </Magnetic>
          {secondary && (
            <Link href={secondary.href} className="btn-outline">{secondary.label}</Link>
          )}
        </div>
        {footnote && (
          <p className="font-spec text-[10px] tracking-wide mt-6" style={{ color: "var(--text-faint)" }}>
            {footnote}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="card p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8"
      style={{
        background: "linear-gradient(135deg, rgba(0,107,143,0.10) 0%, var(--bg-surface) 100%)",
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <div className="flex-1">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">{title}</h2>
        {body && (
          <p className="text-sm leading-relaxed max-w-xl mb-4" style={{ color: "var(--text-muted)" }}>
            {body}
          </p>
        )}
        {footnote && (
          <p className="font-spec text-[10px] tracking-wide" style={{ color: "var(--text-faint)" }}>
            {footnote}
          </p>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
        <Magnetic>
          <Link href={primary.href} className="btn-primary">{primary.label}</Link>
        </Magnetic>
        {secondary && (
          <Link href={secondary.href} className="btn-outline">{secondary.label}</Link>
        )}
      </div>
    </div>
  );
}

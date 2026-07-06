import type { CSSProperties, ReactNode } from "react";
import Parallax from "@/components/motion/Parallax";
import BlueprintDraw from "@/components/motion/BlueprintDraw";

/**
 * Shared page hero: blueprint grid that drifts gently on scroll, drafting
 * corner marks that draw themselves in, and a staggered title rise.
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-accent)" }}
    >
      <Parallax
        speed={0.1}
        className="absolute bg-grid pointer-events-none"
        style={{ left: 0, right: 0, top: -80, bottom: -80 }}
      />
      <BlueprintDraw
        variant="corner"
        size={44}
        className="absolute top-6 left-6 hidden md:block"
        style={{ color: "var(--accent-light)", opacity: 0.55 }}
      />
      <BlueprintDraw
        variant="corner"
        size={44}
        delay={200}
        className="absolute bottom-6 right-6 hidden md:block rotate-180"
        style={{ color: "var(--accent-light)", opacity: 0.55 }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        {eyebrow && (
          <p
            className="hero-rise text-xs font-semibold tracking-[0.2em] uppercase mb-5"
            style={{ color: "var(--accent-light)" }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className="hero-rise text-4xl sm:text-5xl font-bold leading-tight mb-5 max-w-3xl"
          style={{ "--rise": "90ms" } as CSSProperties}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="hero-rise text-lg sm:text-xl leading-relaxed max-w-2xl"
            style={{ color: "var(--text-muted)", "--rise": "180ms" } as CSSProperties}
          >
            {subtitle}
          </p>
        )}
        {children && (
          <div className="hero-rise mt-8" style={{ "--rise": "260ms" } as CSSProperties}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

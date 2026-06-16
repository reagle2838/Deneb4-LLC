export default function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-grid" style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-accent)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-5" style={{ color: "var(--accent-light)" }}>
            {eyebrow}
          </p>
        )}
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-5 max-w-3xl">{title}</h1>
        {subtitle && (
          <p className="text-lg sm:text-xl leading-relaxed max-w-2xl" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

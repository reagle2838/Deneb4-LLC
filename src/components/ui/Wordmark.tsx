import Link from "next/link";

/** Four-point star glyph — a nod to the star "Deneb". */
export function StarGlyph({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 1.5 L14 9.5 L22.5 12 L14 14.5 L12 22.5 L10 14.5 L1.5 12 L10 9.5 Z"
        fill="var(--accent)"
      />
      <path
        d="M12 6 L13 11 L18 12 L13 13 L12 18 L11 13 L6 12 L11 11 Z"
        fill="var(--accent-light)"
      />
    </svg>
  );
}

export default function Wordmark({
  className = "",
  showTagline = true,
  onClick,
}: {
  className?: string;
  showTagline?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={`flex items-center gap-2.5 flex-shrink-0 ${className}`}
      aria-label="Deneb4, Home"
    >
      <StarGlyph className="w-7 h-7 flex-shrink-0" />
      <span className="flex flex-col justify-center leading-none">
        <span className="font-bold text-lg tracking-tight" style={{ color: "var(--text-heading)" }}>
          DENEB<span style={{ color: "var(--accent-light)" }}>4</span>
        </span>
        {showTagline && (
          <span className="font-spec text-[9px] tracking-[0.18em] mt-1" style={{ color: "var(--text-faint)" }}>
            DESIGN · DEVELOPMENT
          </span>
        )}
      </span>
    </Link>
  );
}

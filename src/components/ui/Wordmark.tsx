import Link from "next/link";
import Image from "next/image";

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
      className={`flex items-center flex-shrink-0 ${className}`}
      aria-label="Deneb4, Home"
    >
      <Image src="/logo.png" alt="Deneb4 — Web Design & Development" width={676} height={216} priority className="h-11 lg:h-[72px] w-auto" />
    </Link>
  );
}

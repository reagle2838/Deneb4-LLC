import Link from "next/link";
import { StarGlyph } from "@/components/ui/Wordmark";
import { INDUSTRIES } from "@/data/industries";

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const SERVICES = [
  { label: "Foundation ($4,500)", href: "/services#packages" },
  { label: "Professional ($6,000)", href: "/services#packages" },
  { label: "Enterprise ($8,000)", href: "/services#packages" },
  { label: "Functional Tools", href: "/services#tools" },
];

const COMPANY = [
  { label: "About", href: "/about" },
  { label: "Process", href: "/process" },
  { label: "Work", href: "/work" },
  { label: "Articles", href: "/articles" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export default function Footer() {
  return (
    <footer className="mt-24" style={{ borderTop: "1px solid var(--border-accent)", background: "var(--bg-alt)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Brand */}
          <div className="lg:col-span-1 sm:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <StarGlyph className="w-7 h-7" />
              <span className="font-bold text-lg tracking-tight" style={{ color: "var(--text-heading)" }}>
                DENEB<span style={{ color: "var(--accent-light)" }}>4</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed mb-4 max-w-xs" style={{ color: "var(--text-faint)" }}>
              Web design and development for industrial, engineering, and manufacturing businesses. Sharp work, no agency overhead.
            </p>
            <div className="font-spec text-[11px] space-y-1 mb-5" style={{ color: "var(--text-faint)" }}>
              <div>BUILT FOR BUSINESSES THAT MAKE THINGS</div>
              <div>MON–FRI · 9AM–5PM EST</div>
            </div>
            <div className="flex gap-2">
              <a
                href="https://www.linkedin.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-8 h-8 flex items-center justify-center rounded-sm transition-all"
                style={{ border: "1px solid var(--border-accent)", background: "var(--bg-surface)", color: "var(--text-muted)" }}
              >
                <LinkedInIcon />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-xs font-spec font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--text-muted)" }}>Services</h4>
            <ul className="space-y-2">
              {SERVICES.map((l) => (
                <li key={l.label}><Link href={l.href} className="text-xs transition-colors" style={{ color: "var(--text-faint)" }}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Industries */}
          <div>
            <h4 className="text-xs font-spec font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--text-muted)" }}>Industries</h4>
            <ul className="space-y-2">
              {INDUSTRIES.slice(0, 6).map((i) => (
                <li key={i.slug}><Link href={`/industries#${i.slug}`} className="text-xs transition-colors" style={{ color: "var(--text-faint)" }}>{i.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-spec font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--text-muted)" }}>Company</h4>
            <ul className="space-y-2">
              {COMPANY.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-xs transition-colors" style={{ color: "var(--text-faint)" }}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div id="contact">
            <h4 className="text-xs font-spec font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--text-muted)" }}>Contact</h4>
            <address className="not-italic space-y-4 text-xs" style={{ color: "var(--text-faint)" }}>
              <div>
                <p className="font-spec tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Email</p>
                <a href="mailto:hello@deneb4.com" className="transition-colors" style={{ color: "var(--accent-light)" }}>hello@deneb4.com</a>
              </div>
              <div>
                <p className="font-spec tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Hours</p>
                <p className="leading-relaxed">Monday–Friday<br />9am–5pm EST</p>
              </div>
              <div>
                <Link href="/start" className="btn-outline text-xs">Start a Project →</Link>
              </div>
            </address>
          </div>
        </div>

        <div className="section-divider my-8" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs font-spec" style={{ color: "var(--text-faint)" }}>
            © {new Date().getFullYear()} Deneb4 LLC. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs font-spec transition-colors" style={{ color: "var(--text-faint)" }}>Privacy Policy</Link>
            <Link href="/terms" className="text-xs font-spec transition-colors" style={{ color: "var(--text-faint)" }}>Terms of Service</Link>
            <p className="text-xs font-spec" style={{ color: "var(--text-faint)" }}>Built with Next.js</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Wordmark from "@/components/ui/Wordmark";
import type { CapabilityGroup } from "@/data/services";
import { INDUSTRIES } from "@/data/industries";
import { EXPLORE_LINKS } from "@/data/nav";
import type { Article } from "@/types";

type OpenMenu = "services" | "industries" | "articles" | null;

// Service categories shown in the left rail of the Services panel.
function SwirlIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4a8 8 0 1 0 8 8 5.2 5.2 0 1 0-5.2 5.2 2.6 2.6 0 1 0 2.6-2.6" />
    </svg>
  );
}

// Showcase image shown in the center panel for a given service group.
const GROUP_IMAGES: Record<string, { src: string; w: number; h: number; alt: string }> = {
  "content-systems": { src: "/mega-sales-ops.png", w: 1448, h: 1086, alt: "Deneb4 sales and operations dashboard on a desktop display" },
  collateral: { src: "/mega-collateral.png", w: 1254, h: 1254, alt: "Deneb4 branded print collateral: business cards, line cards, and leave-behinds" },
  "sales-ops": { src: "/mega-content-systems.png", w: 1448, h: 1086, alt: "Deneb4 content management and product catalog interface on a desktop display" },
};

// ── Sub-components ────────────────────────────────────────────────────

function SearchBar({
  value,
  onChange,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-sm flex-1 max-w-sm"
      style={{ border: "1px solid var(--border-accent)", background: "var(--bg-raised)" }}
    >
      <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-faint)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none min-w-0"
        style={{ color: "var(--text-primary)" }}
        aria-label={placeholder}
      />
      {value && (
        <button onClick={() => onChange("")} className="flex-shrink-0" style={{ color: "var(--text-faint)" }} aria-label="Clear search">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95"
      style={{ background: "var(--bg-surface)", border: "2px solid var(--accent)", boxShadow: "0 2px 8px rgba(0,107,143,0.25)" }}
      aria-label="Close menu"
    >
      <svg className="w-5 h-5" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className="w-3 h-3 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : undefined }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function PanelCTAs({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-8 flex flex-col gap-3">
      <Link href="/start" className="btn-primary text-xs justify-center" onClick={onClose}>
        Start a Project
      </Link>
      <a href="mailto:hello@deneb4.com" className="btn-outline text-xs justify-center" onClick={onClose}>
        Email hello@deneb4.com
      </a>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────

export default function Navbar({ articles, serviceGroups }: { articles: Article[]; serviceGroups: CapabilityGroup[] }) {
  const SERVICE_CATS = serviceGroups.map((g) => ({ id: g.id, label: g.title }));
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [activeService, setActiveService] = useState("content-systems");
  const [serviceSearch, setServiceSearch] = useState("");
  const [industrySearch, setIndustrySearch] = useState("");
  const [articleSearch, setArticleSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileServices, setMobileServices] = useState(false);
  const [mobileIndustries, setMobileIndustries] = useState(false);
  const [mobileArticles, setMobileArticles] = useState(false);

  const serviceSearchRef = useRef<HTMLInputElement>(null);
  const industrySearchRef = useRef<HTMLInputElement>(null);
  const articleSearchRef = useRef<HTMLInputElement>(null);

  // Close on route change
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  // Escape closes everything
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpenMenu(null); setMobileOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus trap within an open dialog panel
  useEffect(() => {
    if (!openMenu) return;
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      if (!dialog) return;
      const els = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [openMenu]);

  // Focus the search box when a panel opens
  useEffect(() => {
    if (openMenu === "services") { setServiceSearch(""); setTimeout(() => serviceSearchRef.current?.focus(), 50); }
    else if (openMenu === "industries") { setIndustrySearch(""); setTimeout(() => industrySearchRef.current?.focus(), 50); }
    else if (openMenu === "articles") { setArticleSearch(""); setTimeout(() => articleSearchRef.current?.focus(), 50); }
  }, [openMenu]);

  function closeMenu() { setOpenMenu(null); }
  function toggleMenu(menu: OpenMenu) { setOpenMenu((prev) => (prev === menu ? null : menu)); }

  // ── Filtered data ──
  const q = serviceSearch.trim().toLowerCase();
  const filteredCats = q
    ? SERVICE_CATS.filter((c) => {
        const g = serviceGroups.find((x) => x.id === c.id)!;
        return g.title.toLowerCase().includes(q) || g.items.some((i) => i.toLowerCase().includes(q));
      })
    : SERVICE_CATS;

  const activeCatId = filteredCats.some((c) => c.id === activeService) ? activeService : (filteredCats[0]?.id ?? "content-systems");
  const activeGroup = serviceGroups.find((g) => g.id === activeCatId);

  const filteredIndustries = industrySearch.trim()
    ? INDUSTRIES.filter((i) => i.label.toLowerCase().includes(industrySearch.toLowerCase()) || i.blurb.toLowerCase().includes(industrySearch.toLowerCase()))
    : INDUSTRIES;

  const sorted = [...articles].sort((a, b) => b.date.localeCompare(a.date));
  const aq = articleSearch.trim().toLowerCase();
  const filteredArticles = aq.length >= 2
    ? sorted.filter((a) => a.title.toLowerCase().includes(aq) || a.subtitle.toLowerCase().includes(aq) || a.topic.toLowerCase().includes(aq))
    : [];
  const topicGroups = Array.from(new Set(sorted.map((a) => a.topic))).map((topic) => ({
    topic,
    items: sorted.filter((a) => a.topic === topic && (aq ? a.title.toLowerCase().includes(aq) || a.topic.toLowerCase().includes(aq) : true)),
  })).filter((g) => g.items.length > 0);

  const latestArticle = sorted.find((a) => a.type === "Article") ?? null;
  const latestCaseStudy = sorted.find((a) => a.type === "Case Study") ?? null;

  const isServicesActive = pathname.startsWith("/services");
  const isIndustriesActive = pathname.startsWith("/industries");
  const isArticlesActive = pathname.startsWith("/articles");

  function navBtnStyle(active: boolean, open: boolean): React.CSSProperties {
    return {
      color: active || open ? "var(--text-heading)" : "var(--text-muted)",
      borderBottom: `2px solid ${active ? "var(--accent)" : open ? "rgba(0,107,143,0.5)" : "transparent"}`,
      paddingBottom: "6px",
    };
  }

  const rowLink = "flex items-center justify-between py-3 text-sm transition-colors group";
  const rowStyle = { borderBottom: "1px solid var(--border-accent)", color: "var(--text-muted)" } as React.CSSProperties;
  const onRowEnter = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.color = "var(--text-heading)"; };
  const onRowLeave = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; };

  return (
    <>
      {/* Backdrop */}
      {openMenu && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.50)", top: "96px" }} onClick={closeMenu} aria-hidden="true" />
      )}

      {/* ── Services panel ─────────────────────────────────────── */}
      {openMenu === "services" && (
        <div className="fixed left-0 right-0 hidden lg:flex flex-col z-50 overflow-hidden" style={{ top: "96px", bottom: 0, background: "var(--bg-surface)", borderTop: "1px solid var(--border-accent)" }} role="dialog" aria-label="Services menu">
          <div className="flex items-center gap-4 px-8 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-accent)" }}>
            <SearchBar value={serviceSearch} onChange={setServiceSearch} placeholder="Search services…" inputRef={serviceSearchRef} />
            <CloseBtn onClick={closeMenu} />
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Left rail */}
            <div className="flex flex-col py-4 flex-shrink-0 w-64 overflow-y-auto" style={{ borderRight: "1px solid var(--border-accent)" }}>
              {filteredCats.length === 0 ? (
                <p className="px-6 py-4 text-sm" style={{ color: "var(--text-faint)" }}>No results found.</p>
              ) : filteredCats.map((cat) => {
                const active = activeCatId === cat.id;
                return (
                  <button
                    key={cat.id}
                    className="flex items-center justify-between w-full text-sm py-3.5 px-6 text-left transition-colors"
                    style={{
                      background: active ? "rgba(0,107,143,0.10)" : "transparent",
                      color: active ? "var(--text-heading)" : "var(--text-muted)",
                      borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}`,
                      fontWeight: active ? 600 : 400,
                    }}
                    onMouseEnter={() => setActiveService(cat.id)}
                    onClick={() => setActiveService(cat.id)}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="truncate">{cat.label}</span>
                    <svg className="w-3 h-3 opacity-30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>

            {/* Center detail */}
            <div className="flex-1 overflow-y-auto px-12 py-10">
              {activeGroup && (
                <>
                  <Link href={`/services#${activeGroup.id}`} className="text-2xl font-bold mb-2 inline-block hover:underline" style={{ color: "var(--text-heading)" }} onClick={closeMenu}>
                    {activeGroup.title} →
                  </Link>
                  <p className="text-sm font-semibold mb-8 max-w-2xl leading-relaxed" style={{ color: "var(--accent)" }}>{activeGroup.tagline}</p>
                  <div className="flex gap-10">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-10 self-start" style={{ borderTop: "1px solid var(--border-accent)" }}>
                      {activeGroup.items
                        .filter((i) => !q || i.toLowerCase().includes(q))
                        .map((item) => (
                          <div key={item} className="flex items-center gap-2.5 py-3 text-sm" style={{ borderBottom: "1px solid var(--border-accent)", color: "var(--text-muted)" }}>
                            <span style={{ color: "var(--accent)" }} className="text-[8px] flex-shrink-0">●</span>{item}
                          </div>
                        ))}
                    </div>
                    {GROUP_IMAGES[activeGroup.id] && (
                      <div className="hidden xl:block w-80 flex-shrink-0">
                        <Image
                          src={GROUP_IMAGES[activeGroup.id].src}
                          alt={GROUP_IMAGES[activeGroup.id].alt}
                          width={GROUP_IMAGES[activeGroup.id].w}
                          height={GROUP_IMAGES[activeGroup.id].h}
                          className="w-full h-auto rounded-lg"
                          style={{ border: "1px solid var(--border-accent)" }}
                        />
                      </div>
                    )}
                  </div>
                  <Link href="/services" className="btn-outline text-xs mt-6 inline-flex" onClick={closeMenu}>See all services →</Link>
                </>
              )}
            </div>

            {/* Right sidebar */}
            <div className="w-64 flex-shrink-0 overflow-y-auto py-10 px-8" style={{ borderLeft: "1px solid var(--border-accent)" }}>
              {/* Partner: deployment & infrastructure */}
              <div className="mb-8 p-4 rounded-md" style={{ border: "1px solid var(--accent)", background: "rgba(0,107,143,0.06)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.8} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l2 2 3.5-4" />
                  </svg>
                  <span className="text-[10px] font-spec font-semibold tracking-widest uppercase" style={{ color: "var(--accent)" }}>Deployment</span>
                  <span className="ml-auto text-[9px] font-spec font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded-sm" style={{ background: "var(--accent)", color: "#fff" }}>Partner</span>
                </div>
                <p className="text-xs font-semibold leading-snug mb-1.5" style={{ color: "var(--text-heading)" }}>
                  Software by us, secured deployment by Eagle Technology Solutions.
                </p>
                <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
                  Need it running on secured, on-site infrastructure? You get one turnkey, fully secured system.
                </p>
                <Link href="/services#deployment" className="text-xs font-spec font-semibold inline-flex" style={{ color: "var(--accent)" }} onClick={closeMenu}>Learn more →</Link>
              </div>

              <p className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--text-faint)" }}>Explore</p>
              <div style={{ borderTop: "1px solid var(--border-accent)" }}>
                {EXPLORE_LINKS.map(({ label, href }) => (
                  <Link key={href} href={href} className={rowLink} style={rowStyle} onClick={closeMenu} onMouseEnter={onRowEnter} onMouseLeave={onRowLeave}>
                    <span>{label}</span>
                    <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>

              <PanelCTAs onClose={closeMenu} />
            </div>
          </div>
        </div>
      )}

      {/* ── Industries panel ───────────────────────────────────── */}
      {openMenu === "industries" && (
        <div className="fixed left-0 right-0 hidden lg:flex flex-col z-50 overflow-hidden" style={{ top: "96px", bottom: 0, background: "var(--bg-surface)", borderTop: "1px solid var(--border-accent)" }} role="dialog" aria-label="Industries menu">
          <div className="flex items-center gap-4 px-8 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-accent)" }}>
            <SearchBar value={industrySearch} onChange={setIndustrySearch} placeholder="Search industries…" inputRef={industrySearchRef} />
            <CloseBtn onClick={closeMenu} />
          </div>
          <div className="flex-1 overflow-y-auto px-12 py-10">
            <div className="mb-10">
              <Link href="/industries" className="text-3xl font-bold mb-3 inline-block hover:underline" style={{ color: "var(--text-heading)" }} onClick={closeMenu}>
                Built for businesses that make things →
              </Link>
              <p className="text-base leading-relaxed max-w-2xl mt-2" style={{ color: "var(--text-muted)" }}>
                Deneb4 builds for technically sophisticated, quote-driven companies. Industry literacy is the difference: no learning curve, no generic fluff.
              </p>
            </div>
            {filteredIndustries.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>No industries match your search.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-12 gap-y-2 max-w-6xl">
                {filteredIndustries.map((ind) => (
                  <Link
                    key={ind.slug}
                    href={`/industries#${ind.slug}`}
                    className="flex flex-col py-4 transition-colors group"
                    style={{ borderTop: "1px solid var(--border-accent)" }}
                    onClick={closeMenu}
                  >
                    <div>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>{ind.label}</span>
                    </div>
                    <span className="text-xs leading-relaxed mt-1" style={{ color: "var(--text-muted)" }}>{ind.blurb}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Articles panel ─────────────────────────────────────── */}
      {openMenu === "articles" && (
        <div className="fixed left-0 right-0 hidden lg:flex flex-col z-50 overflow-hidden" style={{ top: "96px", bottom: 0, background: "var(--bg-surface)", borderTop: "1px solid var(--border-accent)" }} role="dialog" aria-label="Articles menu">
          <div className="flex items-center gap-4 px-8 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-accent)" }}>
            <SearchBar value={articleSearch} onChange={setArticleSearch} placeholder="Search articles & topics…" inputRef={articleSearchRef} />
            <CloseBtn onClick={closeMenu} />
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-12 py-10">
              <div className="mb-10">
                <Link href="/articles" className="text-3xl font-bold mb-3 inline-block hover:underline" style={{ color: "var(--text-heading)" }} onClick={closeMenu}>
                  Articles &amp; Insights →
                </Link>
                <p className="text-base leading-relaxed mt-2 max-w-2xl" style={{ color: "var(--text-muted)" }}>
                  Plain-spoken pieces on building websites that work as hard as the businesses they represent.
                </p>
              </div>

              {topicGroups.length === 0 && filteredArticles.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>No results match your search.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-16 gap-y-10 max-w-5xl">
                  {topicGroups.map((group) => (
                    <div key={group.topic}>
                      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-heading)" }}>{group.topic}</h3>
                      <div style={{ borderTop: "1px solid var(--border-accent)" }}>
                        {group.items.map((a) => (
                          <Link key={a.slug} href={`/articles/${a.slug}`} className={rowLink} style={rowStyle} onClick={closeMenu} onMouseEnter={onRowEnter} onMouseLeave={onRowLeave}>
                            <span className="leading-snug pr-3">{a.title}</span>
                            <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Latest sidebar */}
            <div className="w-64 flex-shrink-0 overflow-y-auto py-10 px-8" style={{ borderLeft: "1px solid var(--border-accent)" }}>
              <p className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--text-faint)" }}>Latest</p>
              <div style={{ borderTop: "1px solid var(--border-accent)" }}>
                {([latestArticle, latestCaseStudy].filter(Boolean) as Article[]).map((a) => (
                  <Link key={a.slug} href={`/articles/${a.slug}`} className="flex flex-col gap-1.5 py-4 transition-colors no-underline" style={{ borderBottom: "1px solid var(--border-accent)" }} onClick={closeMenu}>
                    <span className="font-spec text-[10px] self-start" style={{ color: "var(--accent-light)" }}>{a.type}</span>
                    <p className="text-xs font-semibold leading-snug" style={{ color: "var(--text-heading)" }}>{a.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{a.subtitle.length > 90 ? a.subtitle.slice(0, 90) + "…" : a.subtitle}</p>
                  </Link>
                ))}
              </div>
              <PanelCTAs onClose={closeMenu} />
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl saturate-150" style={{ background: "var(--bg-navbar)", borderBottom: "1px solid var(--border-accent)" }}>
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <div className="flex h-16 lg:h-24 items-center gap-6">
            <Wordmark onClick={closeMenu} />

            {/* Desktop nav */}
            <ul className="hidden lg:flex items-center gap-1 flex-1" role="list">
              <li>
                <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors" style={navBtnStyle(isServicesActive, openMenu === "services")} onClick={() => toggleMenu("services")} aria-expanded={openMenu === "services"} aria-haspopup="dialog">
                  Services <Chevron open={openMenu === "services"} />
                </button>
              </li>
              <li>
                <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors" style={navBtnStyle(isIndustriesActive, openMenu === "industries")} onClick={() => toggleMenu("industries")} aria-expanded={openMenu === "industries"} aria-haspopup="dialog">
                  Industries <Chevron open={openMenu === "industries"} />
                </button>
              </li>
              <li>
                <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors" style={navBtnStyle(isArticlesActive, openMenu === "articles")} onClick={() => toggleMenu("articles")} aria-expanded={openMenu === "articles"} aria-haspopup="dialog">
                  Articles <Chevron open={openMenu === "articles"} />
                </button>
              </li>
              <li>
                <Link href="/process" className="px-4 py-2 text-sm font-medium transition-colors" style={navBtnStyle(pathname.startsWith("/process"), false)}>Process</Link>
              </li>
              <li>
                <Link href="/work" className="px-4 py-2 text-sm font-medium transition-colors" style={navBtnStyle(pathname.startsWith("/work"), false)}>Work</Link>
              </li>
            </ul>

            {/* Right: CTA */}
            <div className="hidden lg:flex flex-col items-stretch gap-2 ml-auto flex-shrink-0">
              <Link href="/start" className="btn-primary text-sm justify-center" onClick={closeMenu}>Start a Project</Link>
              <Link
                href="/login"
                onClick={closeMenu}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
                style={{ background: "#ffffff", color: "var(--accent)", border: "1px solid var(--border-accent)", padding: "0.625rem 1.5rem", borderRadius: "2px", letterSpacing: "0.025em" }}
              >
                <SwirlIcon className="w-4 h-4" />
                My Portal
              </Link>
            </div>

            {/* Mobile: hamburger */}
            <div className="lg:hidden flex items-center gap-2 ml-auto">
              <button className="p-2 rounded-sm" style={{ color: "var(--text-muted)" }} onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen}>
                {mobileOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ borderTop: "1px solid var(--border-accent)", background: "var(--bg-surface)" }} role="navigation" aria-label="Mobile navigation">
            <div className="mx-auto max-w-7xl px-4 py-3 space-y-0.5">
              {/* Services */}
              <div>
                <button className="w-full flex items-center justify-between px-3 py-3 text-sm font-medium" style={{ color: "var(--text-heading)" }} onClick={() => setMobileServices(!mobileServices)} aria-expanded={mobileServices}>
                  Services <Chevron open={mobileServices} />
                </button>
                {mobileServices && (
                  <div className="pl-3 pb-2 space-y-0.5">
                    <Link href="/services" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded-sm font-medium" style={{ color: "var(--text-heading)" }}>Web Design &amp; Development</Link>
                    {SERVICE_CATS.map((c) => (
                      <Link key={c.id} href={`/services#${c.id}`} onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded-sm" style={{ color: "var(--text-muted)" }}>
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {/* Industries */}
              <div>
                <button className="w-full flex items-center justify-between px-3 py-3 text-sm font-medium" style={{ color: "var(--text-heading)" }} onClick={() => setMobileIndustries(!mobileIndustries)} aria-expanded={mobileIndustries}>
                  Industries <Chevron open={mobileIndustries} />
                </button>
                {mobileIndustries && (
                  <div className="pl-3 pb-2 grid grid-cols-1">
                    {INDUSTRIES.map((ind) => (
                      <Link key={ind.slug} href={`/industries#${ind.slug}`} onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm rounded-sm" style={{ color: "var(--text-muted)" }}>{ind.label}</Link>
                    ))}
                  </div>
                )}
              </div>
              {/* Articles */}
              <div>
                <button className="w-full flex items-center justify-between px-3 py-3 text-sm font-medium" style={{ color: "var(--text-heading)" }} onClick={() => setMobileArticles(!mobileArticles)} aria-expanded={mobileArticles}>
                  Articles <Chevron open={mobileArticles} />
                </button>
                {mobileArticles && (
                  <div className="pl-3 pb-2 space-y-0.5">
                    <Link href="/articles" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-medium rounded-sm" style={{ color: "var(--text-muted)" }}>All Articles</Link>
                    {sorted.map((a) => (
                      <Link key={a.slug} href={`/articles/${a.slug}`} onClick={() => setMobileOpen(false)} className="block px-3 py-1.5 text-xs rounded-sm" style={{ color: "var(--text-faint)" }}>{a.title}</Link>
                    ))}
                  </div>
                )}
              </div>
              {/* Flat links */}
              {EXPLORE_LINKS.map(({ label, href }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-sm font-medium rounded-sm" style={{ color: "var(--text-heading)" }}>{label}</Link>
              ))}

              <div className="pt-3 pb-4 flex gap-3">
                <Link href="/start" className="btn-primary flex-1 justify-center text-xs" onClick={() => setMobileOpen(false)}>Start a Project</Link>
                <Link href="/login" className="btn-outline flex-1 justify-center text-xs" onClick={() => setMobileOpen(false)}><SwirlIcon className="w-3.5 h-3.5" />My Portal</Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

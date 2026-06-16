import type { ServicePackage, FunctionalTool } from "@/types";

// ── Packages ─────────────────────────────────────────────────────────

export const PACKAGES: ServicePackage[] = [
  {
    id: "foundation",
    name: "Foundation",
    price: "$4,500",
    tagline: "A credible, professionally built web presence with clear lead generation.",
    pages: "5 custom pages",
    revisions: "1 revision round",
    delivery: "~4 week delivery",
    toolCredits: "$500 in functional tool credits",
    aio: "On-page SEO",
    features: [
      "5 custom-designed pages",
      "Mobile-first, responsive build",
      "Contact form",
      "On-page SEO optimization",
      "Google Analytics setup",
      "$500 in functional tool credits",
      "One revision round",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$6,000",
    tagline: "For growing businesses that need more than a basic online presence.",
    pages: "6 custom pages",
    revisions: "2 revision rounds",
    delivery: "6–8 week delivery",
    toolCredits: "$1,500 in functional tool credits",
    aio: "AIO structuring (ChatGPT, Gemini & more)",
    features: [
      "Everything in Foundation",
      "6 custom-designed pages",
      "$1,500 in functional tool credits",
      "AIO structuring for AI discoverability",
      "Two revision rounds",
      "Advanced on-page SEO",
    ],
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$8,000",
    tagline: "A site built to carry real operational weight.",
    pages: "7 custom pages",
    revisions: "2 revision rounds",
    delivery: "8–10 week delivery",
    toolCredits: "$2,500 in functional tool credits",
    aio: "Full AIO optimization",
    features: [
      "Everything in Professional",
      "7 custom-designed pages",
      "$2,500 in functional tool credits",
      "Full AIO optimization",
      "Priority build scheduling",
      "Extended documentation & handover",
    ],
  },
];

// ── Functional tools (custom-built features) ─────────────────────────

export const FUNCTIONAL_TOOLS: FunctionalTool[] = [
  { label: "Product Catalog",      price: "from $500", desc: "Filterable, searchable product or equipment catalog with specs and categories." },
  { label: "Quote Request Form",   price: "$500",      desc: "Structured RFQ form routed to your inbox, built for spec-driven, quote-based sales." },
  { label: "Careers + Resume Upload", price: "$750",   desc: "Job listings with an application form and resume/file upload." },
  { label: "Blog / Articles",      price: "$1,000",    desc: "Article system for technical content, case studies, and insights." },
  { label: "Content Editor (CMS)", price: "$1,000",    desc: "Edit page content yourself without touching code." },
  { label: "FAQ Manager",          price: "$500",      desc: "Self-managed, structured FAQ that doubles as AIO-friendly content." },
  { label: "Protected Area",       price: "$1,200",    desc: "Login-gated pages for dealers, distributors, or internal documents." },
  { label: "Custom Chatbot",       price: "$1,200",    desc: "A scoped assistant trained on your products, specs, and FAQs." },
];

// ── Add-ons ──────────────────────────────────────────────────────────

export const ADD_ONS: { label: string; price: string }[] = [
  { label: "Additional page",            price: "$250 each" },
  { label: "Extra revision round",       price: "$150 each" },
  { label: "CMS section expansion",      price: "$200 / section" },
  { label: "Ongoing maintenance",        price: "quoted per request" },
];

// ── Ownership model ──────────────────────────────────────────────────

export const OWNERSHIP_POINTS: string[] = [
  "You own the full source code and all associated data.",
  "No recurring licensing fees and no mandatory monthly retainers.",
  "Your hosting, domain, and analytics accounts stay in your name.",
  "Fixed-scope, fixed-price delivery — quoted before work begins.",
];

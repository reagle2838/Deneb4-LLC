// ── Web Design & Development capability groups ───────────────────────
// One offering, organized into capability areas (no fixed tiers).

export interface CapabilityGroup {
  id: string;
  title: string;
  tagline: string;
  items: string[];
}

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: "content-systems",
    title: "Website + Content Systems",
    tagline: "The website and the content infrastructure behind it, built to run without you in the weeds.",
    items: [
      "CMS setup",
      "Product / service catalog setup",
      "Case study / portfolio library",
      "Careers pages",
      "Galleries",
      "File upload workflows",
      "Quote request systems",
      "Client portals",
    ],
  },
  {
    id: "sales-ops",
    title: "Sales & Operations Systems",
    tagline: "Lightweight systems to capture leads, track follow-ups, and see what's working.",
    items: [
      "Lightweight CRM setup",
      "Lead intake workflows",
      "Quote follow-up tracking",
      "Sales dashboards",
      "Campaign trackers",
      "Support request intake",
      "Client update request systems",
    ],
  },
  {
    id: "collateral",
    title: "Sales Collateral & Print Materials",
    tagline: "Print and physical materials that match the brand and close the loop offline.",
    items: [
      "Business cards",
      "QR code cards",
      "Postcards",
      "Brochures",
      "Capability statements",
      "Product / service line cards",
      "Leave-behind flyers",
      "Sales folders",
      "Proposal packets",
      "Trade show handouts",
      "Branded client handoff binders",
      "Printed onboarding packets",
    ],
  },
];

// ── Add-ons ──────────────────────────────────────────────────────────

export const ADD_ONS: { label: string; price: string }[] = [
  { label: "Additional page", price: "quoted per scope" },
  { label: "Extra revision round", price: "quoted per scope" },
  { label: "CMS section expansion", price: "quoted per scope" },
  { label: "Ongoing maintenance", price: "quoted per request" },
];

// ── Ownership model ──────────────────────────────────────────────────

export const OWNERSHIP_POINTS: string[] = [
  "You own the full source code and all associated data.",
  "No recurring licensing fees and no mandatory monthly retainers.",
  "Your hosting, domain, and analytics accounts stay in your name.",
  "Fixed-scope, fixed-price delivery: quoted before work begins.",
];

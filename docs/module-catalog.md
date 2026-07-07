# Deneb4 Module Catalog: DRAFT for Ridhi's approval

**Status: APPROVED** (2026-07-07). This is the closed menu of everything Deneb4 offers. Nothing off this list gets built for a client (out-of-catalog requests are structural requests and stay behind Ridhi's permanent gate). Revisit and re-approve if the menu changes.

Legend for Source: **(named)** = you listed it explicitly · **(exists)** = already running on deneb4.com or the portal today · **(proposed)** = my suggestion, cut freely.

## Foundation

| Module | Source | Status |
|---|---|---|
| Base marketing site (home, about, services, industries, contact, legal) | (exists) deneb4.com itself is the working pattern | Needs templating from your template repo |
| Menu-driven design system (layout + theme variants selected by the form) | (named: "design per the check box form") | To build |

## Content modules

| Module | Source | Status |
|---|---|---|
| Image/project gallery | (named) | To template |
| Articles/insights CMS | (named: "CMS, article creators") · (exists: Keystatic articles) | Exists; needs per-client templating |
| Product/Service Catalog. **Commercial rule (decided):** up to 50 pre-seeded items included, editable by client; seeding beyond 50 is an upcharge; client self-serve additions require the CMS-with-catalog option | (named) | To template |
| Case studies / work showcase | (exists on deneb4.com) (proposed for client sites) | To template |
| FAQ | (exists) (proposed) | To template |
| Team / certifications / capabilities page | (proposed: industrial buyers check credentials) | To template |

## Sales and operations modules

| Module | Source | Status |
|---|---|---|
| Campaign tracker | (named) | To template |
| Support request intake | (named) | To template |
| Client update request system | (named) | To template |
| Quote / RFQ request form | (proposed: fits quote-driven buyers; contact/brief forms exist as the pattern) | To template |
| Contact + inquiry forms with email delivery | (exists) | Exists; needs per-client templating |

## Client-facing infrastructure (Deneb4-side, per client)

| Module | Source | Status |
|---|---|---|
| Client portal (progress, approvals, messages, files, billing) | (exists) | Exists |
| Staging feedback widget | (exists) | Exists |
| Email notifications (Resend) | (exists) | Exists |
| SEO/AIO structured data pack + analytics (GA4) | (exists) | Exists; needs per-client templating |

## Definition of "templated" (every module must ship with all six)

1. **Purpose:** one paragraph, client-facing language.
2. **Config options:** exactly which 60-Q form answers change it (toggles, variants, limits).
3. **Copy slots:** which facts the client must supply; bots may only assert supplied facts.
4. **Integration points:** what it needs from the base template and other modules.
5. **Test checklist:** module tests plus assembly checks (build, render, function, contrast, links).
6. **Handoff notes:** accounts, keys, env vars it creates; everything flagged "rotate before use."

---

**Ridhi's action:** edit the tables above (strike/add/rename), then change the Status line at top to APPROVED. The approved version becomes the boundary the compiler and the form are built against.

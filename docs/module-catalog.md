# Deneb4 Module Catalog

**Status: ALIGNED to the real d4 ecosystem** (2026-07-10; originally approved 2026-07-07 as a plan, now superseded by the shipped repos). The operational source of truth is **`registry.json` in [d4-site-builder](https://github.com/deneb4admin/d4-site-builder)**: the registry is the closed menu, and the assembler refuses anything off it. This document is the human-readable companion: what each module is, what it provides, and what is still future work.

Anything a client asks for that is not on this menu is a **structural request**: it stays behind Ridhi's permanent gate and routes to a Claude Cowork session (see `docs/agents.md`).

## The shipped ecosystem (github.com/deneb4admin)

| Repo | Kind | What it provides |
|---|---|---|
| **d4-site-builder** | tool | The assembler: manifest schema, `registry.json` (closed menu + deterministic assembly order), validation, conflict detection, generated wiring (nav, admin panels, site config, theme), `d4.assembly.json` build record. |
| **d4-site-template** | site (always included) | Base Next.js 15 shell: layout, header/footer with the nav slot system, home/about/contact pages, contact form (Resend with `data/messages.json` fallback), theme via CSS variables (3 presets: slate-teal, warm-sand, ink-indigo; custom palettes supported). |
| **d4-cms-core** | core (dependency of all feature modules) | `/admin`: password login (+ optional TOTP 2FA), admin dashboard shell with declarative panel registration, JSON data store (`data/*.json`), authenticated image uploads. Requires `ADMIN_PASSWORD`. |
| **d4-careers-portal** | feature | `/careers` public listings + inline applications (stored, and emailed when Resend is configured), admin panel for postings. |
| **d4-insights-blog** | feature | `/insights` article index + `/insights/[id]` pages, markdown bodies, cover images, admin editor. |
| **d4-catalog** | feature | `/catalog` filterable product grid (categories, specs, part numbers, images), admin management. Commercial rule (decided 2026-07-07): up to **50 pre-seeded items** included, seeding beyond 50 is an upcharge; client self-serve additions come with this module's admin panel. |
| **d4-gallery-editor** | feature | `/gallery` page + reusable `<Gallery slug>` component, named galleries with upload/reorder/alt-text admin. |

## How a client site is composed

- The **build config** (`content/build-configs/<slug>.json`) is the structural contract: site identity (name, tagline, description, contact details), theme, and which modules are on. The Builder agent assembles it, git-inits it as the client's own repo, QAs it, and applies later config changes incrementally (see `docs/agents.md`).
- **Client content is not in the build config.** Jobs, articles, products, and gallery images are authored through the assembled site's own `/admin` dashboard into its `data/*.json` store, either by the client, by Ridhi, or (future) seeded by an agent from intake material.

## Future module candidates (from the original plan, not yet built)

These were in the approved 2026-07-07 menu and remain wanted; each would become a new `d4-*` repo with a manifest, registered in `registry.json`:

- Campaign tracker (sales/marketing campaign management)
- Support request intake (ticket-style requests, depends on cms-core)
- Client update request system (structured change requests, depends on cms-core)
- Quote / RFQ request form (industrial quote-driven buyers)
- Team / certifications / capabilities page (static credibility module)

Adding one = build the repo with a valid `manifest.json` (see the schema in d4-site-builder), pass `bin/validate.mjs`, add it to `registry.json`. The Builder, QA, and change loop pick it up with no changes on this side.

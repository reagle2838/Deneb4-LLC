# Deneb4 Autonomy Roadmap

**Vision:** Deneb4 runs as a mostly autonomous studio. A small team of agents handles intake, provisioning, assembly, QA, client communication, billing, handoff, and maintenance. Ridhi's required role shrinks to: discovery calls (when a client requests one) and the human approval gates below.

**Keystone principle:** every autonomous step is only as trustworthy as the verification harness underneath it. The test suite that can answer "is this assembled site correct?" is the load-bearing wall. Build it early (Phase 3), not last.

**Working note:** internal agent communication lives in the Workspace at `/cms-admin` (Agents tab), backed by per-client ledger files and the `/api/agents/ledger` API.

---

## Architecture decision (2026-07-09): git-native, incremental Builder

Confirmed by Ridhi, supersedes the "regenerate from a config" model that Builder v1 proved:

- **Each client's website lives in its own GitHub repo**, not a local `builds/<slug>/` folder that gets deleted and regenerated. The repo IS the site; git history IS the project's daily progress log.
- **The Builder does not build from scratch.** For a website request, it clones/pulls the **existing template repo** (name TBD, Ridhi to provide) and builds on top of it per the client's spec, the template repo is the real starting point, not `templates/starter/` (which only proved the assembly mechanics on a placeholder).
- **Work incrementally, like a person would:** pull the current state of the client's repo → see what's already there, including any manual edits Ridhi made → make the specific change being asked for → commit → push. Never a blind wipe-and-regenerate. This is also what fixes the "Ridhi hand-edits something and it survives" problem: a manual edit is just a commit, and the next agent run starts from that commit, not from a fresh copy.
- **"Continue work each day until finished"**: an agent resuming a project just means pulling that client's repo, checking progress against the pipeline stage + ledger, and continuing. Same durable-state pattern already used for conversations (the ledger) and project stage (the pipeline), now extended to the actual code.
- **Consequence for QA (Phase 3):** the verification harness will need to handle whatever the real template's build/serve story is (this is unknown until the template repo is shared — could be a static build, could need `next build`/`next start`, etc.), not only the static-stub model `verify.mjs --manifest` was proven against.
- **Blocked on:** the template repo (name/access, Ridhi to provide — see Phase 1), and a GitHub API credential so agents can create/clone/commit/push per-client repos (see Phase 4). Builder v1's deterministic engine (module toggles, theme, fact-slot copy, QA handoff, escalation) is not wasted, it's the config layer that will sit on top of the git workflow once both land.

## Architecture decision (2026-07-09): Google Workspace intake

Confirmed by Ridhi: client specs come from a **Google Form** plus several supporting **Google Docs** the client fills out, not a custom-built form on the Deneb4 site. Agents (and/or Claude Cowork) need read access to the form responses and the associated docs. This replaces the earlier "60-question checkbox form built in-house" framing in Phase 2 below. Ridhi will provide the specific form/docs and Google Workspace access details later.

## Note: Claude Cowork's role in the flow

Confirmed by Ridhi: Claude Cowork (a supervised, interactive Claude Code session, not an unattended agent) is the designated path for anything the deterministic agents can't or shouldn't handle on their own: **structural requests** (already a permanent human gate per Phase 0), **one-off manual overrides** Ridhi wants to make herself, debugging something QA didn't anticipate, and building out new template modules for the catalog. It works directly against a client's real repo once that exists (see the git-native Builder decision above). This formalizes what was already implicit: agents handle the repeatable work, Claude Cowork handles the judgment calls. (To do later: reflect this explicitly in `docs/agents.md` as the structural-request escalation path.)

---

## Phase 0: Decisions (owner: Ridhi)

| # | Decision | Status |
|---|---|---|
| 1 | **Catalog boundary.** Everything offered is pre-templated; nothing off-menu. Product/Service Catalog module rule: up to **50 pre-seeded catalog items** included (editable by client afterward). Seeding beyond 50 is an **upcharge**. Clients can add unlimited items themselves **only if their package includes the CMS with catalog management**. Full module menu: see `docs/module-catalog.md`. | DECIDED, menu APPROVED 2026-07-07 |
| 2 | **Disclosure stance.** Honest, never deceptive. Some internals may be left unsaid, but nothing stated may mislead. Copy and client comms must survive the question "is this literally true?" | DECIDED |
| 3 | **Human gates.** Kept: scheduled appointments, start-approval, design review, copy review, structural requests, payment, handoff. Relaxation plan below, thresholds confirmed by Ridhi. | DECIDED |
| 4 | **Pricing/packaging.** Deferred. Revisit after the catalog menu is approved. | DEFERRED |

### Gate map and relaxation plan (thresholds confirmed by Ridhi, 2026-07-07)

| Gate | Who holds it today | Proposed relaxation trigger | End state |
|---|---|---|---|
| Scheduled appointments (discovery calls) | Ridhi | Never: this is the human face of the business | Human, permanent |
| Start-approval (new client enters pipeline) | Ridhi | Never: commits scope and money | Human, permanent |
| Design review (before client sees staging) | Ridhi | 10 consecutive builds approved with zero visual edits AND visual-regression suite green | Spot checks |
| Copy review | Ridhi | 10 consecutive builds with zero fact corrections, with fact-slot enforcement live (bots may only assert facts the client supplied) | Spot checks |
| Structural requests (anything out of catalog) | Ridhi | Never: out-of-catalog equals new engineering | Human, permanent |
| Payment (final invoice decision) | Ridhi | Never: automation sends and detects, human decides | Human confirms, permanent |
| Handoff (credentials doc + ownership transfer) | Ridhi | 5 consecutive clean handoffs with the secure secrets flow proven | Spot checks |

---

## Phase 1: Product core (the moat)

- [x] **[Ridhi]** Template ecosystem DELIVERED 2026-07-09 as seven public GitHub repos under `deneb4admin`: **d4-site-builder** (the assembler: manifest schema, registry.json closed menu, deterministic wiring), **d4-site-template** (Next 15/React 19/Tailwind base with nav slot system + theme presets), **d4-cms-core** (/admin auth + TOTP, JSON data store, uploads, panel registry), and four feature modules (**d4-careers-portal**, **d4-insights-blog**, **d4-catalog**, **d4-gallery-editor**). Production-grade: no leftover branding, builds clean, modules declare routes/nav/adminPanels/env via manifests.
- [x] **[Claude]** Verified the base template builds to production grade (assembled site compiles + type-checks clean, 12 routes) (2026-07-09)
- [x] **[Claude]** `docs/module-catalog.md` aligned with the real d4 registry (2026-07-10): registry.json is the operational closed menu; the doc now describes the 7 shipped repos + future module candidates (campaign tracker, support intake, update requests, RFQ, team page)
- [x] **[Ridhi]** Modules exist as versioned, toggleable components with manifests (the d4 repos)
- [x] **[Ridhi]** Menu-driven theming: 3 presets (slate-teal, warm-sand, ink-indigo) + custom palette support in the assembler
- [ ] **[Claude]** Fact-slot copy enforcement for generated/refined copy (the d4 build config carries identity fields verbatim today; applies when the LLM copy layer activates)

## Phase 2: Intake-to-build compiler

- [x] **[Ridhi]** Intake mechanism decided: a **Google Form** plus several supporting **Google Docs** the client fills out (not a custom in-house form). Specific form/docs + Google Workspace access — Ridhi to provide later.
- [ ] **[Claude]** Google Workspace read access for agents/Claude Cowork (Forms responses + Docs) — see Phase 4
- [ ] **[Both]** Answer-to-config mapping rules: every form/doc field maps to a concrete, testable build operation
- [ ] **[Claude]** Config schema (extends the Builder v1 `BuildConfig` shape already proven)
- [ ] **[Claude]** Brand ingestion (palette, fonts, logo from client's existing site)
- [ ] **[Claude]** The compiler: parsed intake in, build config out, feeding the git-native Builder (see architecture decision above)

## Phase 3: Verification harness (keystone)

- [x] **[Claude]** Site verification harness `scripts/verify.mjs` (+ `npm run verify:site <url>`): dependency-free checks against a running site (critical routes render, auth gates behave, page structure = title + h1, internal-link crawl, key assets), machine-readable pass/fail + exit code, optional QA-ledger reporting (`--client --key --report-to`). This is the QA agent's tool + a regression guard for Deneb4 itself; points at a client staging URL later. (done)
  - **It immediately caught a real, pre-existing bug** (see note below).
- [ ] **[Claude]** Per-module test suites (needs the module catalog / template)
- [x] **[Claude]** Browser-dependent checks (2026-07-11): `verify.mjs` now runs real-browser checks via Playwright (installed in THIS repo only; client builds never need it), enabled automatically when the Builder passes `--qa-dir` (or manually with `--browser on`). Four new checks: **browser errors** (console errors, page exceptions, failed same-origin requests per route), **accessibility via axe-core** (real rendering; critical/serious violations fail QA, which includes real color contrast), **mobile overflow** (no horizontal scroll at 375px), and **visual snapshots** (full-page screenshots per route, pixel-diffed against a last-known-good baseline; informational, not a gate, since intentional changes change pixels; the changed-page list goes into the ledger summary as evidence for Ridhi's review, and the baseline refreshes only when the whole battery passes). QA artifacts live at `builds/.qa/<slug>/` (baseline/current/diff), outside the client repo so its git history stays clean. Verified E2E on acme-demo: green change build (visual changes correctly listed per page), fault-injected red build (browser errors caught the bogus route, change auto-reverted, baseline untouched).
- [x] **[Claude]** QA adapted to the real templates: the Builder derives the verify manifest from the assembler's per-site `d4.assembly.json` (routes by owning module), builds + serves the real Next app, and runs the harness against it. Dynamic routes (`/insights/[id]`) and deep admin pages are skipped until content seeding/session support exist. (2026-07-09)

> **✔ RESOLVED (2026-07-11) — FINDING (2026-07-08, from the harness): Keystatic content was silently half-broken on the live site.** Root cause confirmed: with `path: 'content/x/*'` (no trailing slash), Keystatic expects entries as `content/x/<slug>.yaml` with linked files in `content/x/<slug>/`; the hand-written entries were stored as `<slug>/index.yaml` (the trailing-slash layout) and were invisible to the reader. The Eagle Engineering case study yaml additionally had an unquoted `: ` in its summary, making it invalid YAML outright. Fixed by a one-time migration matching the canonical layout of the one CMS-saved article exactly: moved each `index.yaml` up to `<slug>.yaml`, flattened `title: {name, slug}` to the plain name string (the slug is the filename), fixed the invalid summary with a block scalar. Verified: the reader lists all 6 articles + the case study, `/work/eagle-engineering` renders 200, all internal links green. Future entries saved through `/keystatic` were always in the correct format and are unaffected.

> **⚠ FINDING (2026-07-11, from the new browser checks, run against the Deneb4 site itself): two design tokens fail WCAG AA contrast sitewide.** `--text-faint: #7d8d9b` (~26 nodes/page on the light backgrounds, ratio ~3.2 vs required 4.5) and `--accent-light: #1f93ba` as text on white (ratio ~3.5). Closest same-hue compliant values: `#65727e` (4.59:1) and `#1a7a9a` (4.89:1) in `src/app/globals.css`. Also `link-in-text-block` on `/contact` and `/start` (links distinguishable only by color). These change the site's look, so they are **Ridhi's design decision, not auto-fixed**. Note: the d4 client template passes the same gate cleanly, so client sites are unaffected. A `/process` mobile overflow (fanned card deck pushing past a 375px viewport) WAS fixed, since that was a layout bug, not a design choice.

## Phase 4: Infrastructure and credentials

- [ ] **[Both]** Deploy pipeline decision: test Hostinger's real API for subdomains/deploys; script around it or route staging elsewhere
- [ ] **[Claude]** Staging provisioning + auto-link into portal + client alert
- [ ] **[Claude]** Production deploy + DNS handover automation
- [ ] **[Ridhi]** Re-enable CMS auth (delete `CMS_AUTH_DISABLED` from `.env.local`) when testing ends
- [ ] **[Claude]** Scoped agent credentials, secrets store, rotation policy (Google, Hostinger, Wave, CMS, git)
- [ ] **[Ridhi]** GitHub credential for agents: a token (or GitHub App) that can create/clone/commit/push **per-client repos**. Also decide where those repos live — a dedicated org, or Ridhi's personal account for now (open question from 2026-07-08 chat).
- [ ] **[Ridhi]** Google Workspace credential for agents/Claude Cowork: read access to the intake Google Form's responses and the supporting Google Docs (Ridhi has Google Workspace; specifics to follow)
- [ ] **[Both]** Hook up Supabase (noted 2026-07-08 by Ridhi; scope/purpose not yet defined, e.g. replacing flat YAML storage for clients/leads/tasks/ledger, or something else — clarify before building)

## Phase 5: Agent system and shared workspace

- [x] **[Claude]** Shared per-client agent ledger + Agents tab in Workspace + `/api/agents/ledger` (done)
- [x] **[Claude]** Per-client pipeline state machine: 9 stages in `src/lib/pipeline.ts`, `pipeline` field on Client, single-writer `/api/agents/pipeline` (idempotent, every transition auto-logged to the client's ledger channel), PipelinePanel in the command center + roster labels (done)
- [x] **[Ridhi]** Agent contracts in `docs/agents.md` APPROVED 2026-07-08
- [x] **[Claude]** Agent heartbeat: `/api/agents/tick` (POST = run all sensing duties, GET = run history). Duties run isolated (one failure never sinks the rest), each run recorded to a run log (`agent-runs.yaml`), once-per-day dedup via `agent-state.yaml`. Live duties: calendar digest + client worklist (unread messages + pending drafts + projects at a gate). form-received/payment-received stubbed pending Drive/Wave. Agents tab is now a control surface: heartbeat status + per-duty outcomes, a "Run heartbeat now" button, and a readiness strip (Email/Calendar/Agent-key wired vs pending, plus a CMS-auth-disabled warning). (done)

> **Functional verification (2026-07-08):** the whole agent system + portal + workspace was exercised against a real `npm run build` production server: all marketing routes 200, portal/portal-feedback gate correctly (307), cms-admin renders, and every agent flow works end to end (ledger, pipeline transitions, heartbeat + worklist, draft-reply gate with verified portal/widget non-leak + approve, onboarding + welcome email, alert escalation). All three notification emails fired (console fallback) with zero runtime errors in the prod log.
- [ ] **[Both]** Point a scheduler at `POST /api/agents/tick` (Hostinger cron / Task Scheduler / cloud agent), same decision as the calendar trigger
- [x] **[Claude]** Escalation, part 1: any agent posting a `kind: alert` ledger entry emails Ridhi immediately (the alert-and-stop rule from docs/agents.md) (done)
- [x] **[Claude]** Error handling, part 2: tick duties are failure-isolated and every run is logged; any duty error escalates to Ridhi's inbox (done)

## Phase 6: Pipeline stages (ops layer; many independent quick wins)

- [x] **[Claude]** Calendar check endpoint: `/api/agents/calendar-check` (GET preview, POST = email digest + Studio ledger entry; reads the calendar's secret iCal address, no OAuth) (done)
- [ ] **[Ridhi]** Paste the calendar's "secret address in iCal format" into `GOOGLE_CALENDAR_ICS_URL` in `.env.local` (instructions in the file)
- [ ] **[Both]** Pick the daily trigger: Hostinger cron hitting the endpoint in production, Windows Task Scheduler locally, or a scheduled cloud agent
- [x] **[Claude]** Provisioning, part 1: client creation posts a birth record to the ledger, and portal credentials can be emailed to the client on create and on password reset (opt-in checkboxes; falls back to shown-once + manual share until Resend is configured) (done)
- [ ] **[Claude]** Provisioning, part 2: Drive folder creation + intake doc sharing (needs Google Drive API credentials)
- [ ] **[Claude]** Intake delivery, collection, parse into compiler config
- [x] **[Claude]** Build orchestration loop, engine proof (BUILDER AGENT v1, on a STUB template): deterministic assembly engine (`scripts/builder/*.mjs`) + runner (`scripts/build-client.mjs`, `npm run builder`). Takes a hand-authored build config (`content/build-configs/<slug>.json`), assembles a static site from `templates/starter/` into `builds/<slug>/` (config-level: toggle modules, apply theme, inject supplied facts; fact-slot rule enforced, never fabricates), serves it locally, runs the template-aware QA harness (`verify.mjs --manifest`), and on green writes a change summary to the client ledger + advances pipeline to `internal-review` and STOPS at Ridhi's gate; on validation/QA/exception failure it escalates (alert email) and stays at `building`. Hybrid: optional key-gated LLM copy layer (`ANTHROPIC_API_KEY`) that only rephrases supplied copy. Verified end-to-end (green, gated-stage refusal, both escalation paths, idempotency, regression-safe QA edit, tsc clean). (done)
  - **Swappable stub:** `templates/starter/` + `template.json` is a placeholder proving the assembly mechanics (config validation, module toggling, theme, fact-slot copy, ledger/pipeline/escalation wiring). Those mechanics carry forward.
  - To run the demo: create a client at pipeline `building`, then `npm run builder -- <slug> --report-to http://localhost:3005` (example configs: `content/build-configs/acme-demo.json` valid, `broken-demo.json` invalid).
- [x] **[Claude]** BUILDER AGENT v2, git-native, driving the REAL d4 ecosystem (done 2026-07-09, verified end-to-end): `npm run builder -- <slug> --report-to <origin>` mirrors the 7 d4 repos into `vendor/d4/` (recording exact commit SHAs to the ledger), runs Ridhi's `d4-site-builder` assembler with the client's config (`content/build-configs/<slug>.json`, d4 format), git-inits the output as the client's own repo (initial commit + lockfile commit), npm-installs + `next build`s + serves the real app, QAs it via the derived manifest, and on green posts the change summary + advances to `internal-review` and STOPS at Ridhi's gate; failures escalate (assembler's own closed-menu enforcement verified: unknown module → alert email → pipeline stays at building). Existing builds are NEVER wiped (re-run refuses; incremental changes come via the future change loop). GitHub push layer written but **dormant until GITHUB_TOKEN + GITHUB_OWNER are set** (then: private repo `d4-client-<slug>` auto-created + pushed). v1 stub engine + `templates/starter/` deleted (superseded).
  - Live demo: client `acme-demo` (Acme Fabrication) assembled at `builds/acme-demo` — a real git repo with the site; Ridhi can delete the client + folder when done exploring.
  - The incremental change loop is now DONE (see the change-implementation item below). Remaining Builder-adjacent work: the Comms agent producing change-lists/config edits from client comments (see the Comms item below).
- [x] **[Claude]** Draft-reply gate (the copy-review human gate): agents propose replies via `/api/clients/feedback` action `draft` (x-agent-key allowed); they live in a separate `draftReplies` array that never reaches the portal or widget; Ridhi approves/edits/rejects in the Workspace MessageThread; approving sends the reply + emails the client. Agents can propose but only Ridhi (CMS session) can approve. Pending drafts surface in the daily worklist. (done)
- [ ] **[Claude]** Comms agent that actually drafts the replies + change-lists from client comments (the headless side that fills the gate above; needs the build loop)
- [x] **[Claude]** Change-implementation loop (done + verified E2E 2026-07-10): the build config is the single source of truth; editing `content/build-configs/<slug>.json` and re-running `npm run builder -- <slug> --report-to <origin>` auto-detects the existing client repo and applies ONLY the delta: identity/theme artifact updates, module payload adds/removes (assembled fresh via Ridhi's own d4-site-builder into a temp dir and content-synced, so generation never drifts), then commits with a descriptive message, re-QAs the real app, and on green pushes (token-gated) + reports to the ledger WITHOUT advancing the pipeline. **QA-rejected changes are automatically git-reverted** back to the last good state + escalated. Manual/Cowork edits elsewhere in the repo survive verbatim (verified). Unchanged config = clean no-op. Runs at `building` or `client-review`; refuses gated stages and dirty working trees. Verified: migration sync, identity change + manual-edit survival, add d4-insights-blog (route live + QA'd), remove d4-careers-portal (payload + nav cleanly deleted), fault injection → auto-revert, no-op detection.
- [ ] **[Claude]** Approval, sign-off docs, final Wave invoice, payment detection
- [ ] **[Claude]** Credential documentation + secure delivery ("rotate before use" enforced) + handoff checklist execution

## Phase 7: Maintenance system (after build pipeline is proven)

- [ ] **[Claude]** Update loop: detect, patch, run harness, green ships / red escalates
- [ ] **[Claude]** Fleet propagation: canary, verify, gradual rollout, automated rollback, human gate for anything not clean-green
- [ ] **[Claude]** Fleet monitoring, uptime, alerting

## Phase 8: Rollout

- [ ] **[Both]** Dogfood end-to-end on a throwaway client with every gate manual
- [ ] **[Ridhi]** Relax gates one at a time per the table above as the harness earns trust

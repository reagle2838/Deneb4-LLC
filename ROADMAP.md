# Deneb4 Autonomy Roadmap

**Vision:** Deneb4 runs as a mostly autonomous studio. A small team of agents handles intake, provisioning, assembly, QA, client communication, billing, handoff, and maintenance. Ridhi's required role shrinks to: discovery calls (when a client requests one) and the human approval gates below.

**Keystone principle:** every autonomous step is only as trustworthy as the verification harness underneath it. The test suite that can answer "is this assembled site correct?" is the load-bearing wall. Build it early (Phase 3), not last.

**Working note:** internal agent communication lives in the Workspace at `/cms-admin` (Agents tab), backed by per-client ledger files and the `/api/agents/ledger` API.

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

- [ ] **[Ridhi]** Provide the template website (where does it live? repo/folder) so it can be audited and versioned
- [ ] **[Claude]** Harden the base template to production grade; make it the versioned foundation
- [ ] **[Ridhi]** Approve/edit the module menu in `docs/module-catalog.md`
- [ ] **[Claude]** Build each approved module as a pre-tested, versioned, toggleable component
- [ ] **[Claude]** Menu-driven design system: pre-designed layout/theme variants so "design" = choosing from a menu
- [ ] **[Claude]** Fact-slot copy templates; enforce "only assert facts the client supplied"

## Phase 2: Form-to-build compiler

- [ ] **[Both]** Design the 60-question checkbox form; every answer maps to a concrete, testable build operation
- [ ] **[Claude]** Config schema + answer-to-config mapping rules
- [ ] **[Claude]** Brand ingestion (palette, fonts, logo from client's existing site)
- [ ] **[Claude]** The compiler: config in, assembled site out

## Phase 3: Verification harness (keystone)

- [ ] **[Claude]** Per-module test suites (make "pre-tested" a re-runnable fact)
- [ ] **[Claude]** Assembly/integration suite: builds, renders, tools function with this config, contrast/accessibility, links valid
- [ ] **[Claude]** Machine-checkable "definition of done" per build and per change + visual regression

## Phase 4: Infrastructure and credentials

- [ ] **[Both]** Deploy pipeline decision: test Hostinger's real API for subdomains/deploys; script around it or route staging elsewhere
- [ ] **[Claude]** Staging provisioning + auto-link into portal + client alert
- [ ] **[Claude]** Production deploy + DNS handover automation
- [ ] **[Ridhi]** Re-enable CMS auth (delete `CMS_AUTH_DISABLED` from `.env.local`) when testing ends
- [ ] **[Claude]** Scoped agent credentials, secrets store, rotation policy (Google, Hostinger, Wave, CMS, git)

## Phase 5: Agent system and shared workspace

- [x] **[Claude]** Shared per-client agent ledger + Agents tab in Workspace + `/api/agents/ledger` (done)
- [x] **[Claude]** Per-client pipeline state machine: 9 stages in `src/lib/pipeline.ts`, `pipeline` field on Client, single-writer `/api/agents/pipeline` (idempotent, every transition auto-logged to the client's ledger channel), PipelinePanel in the command center + roster labels (done)
- [ ] **[Ridhi]** Approve/edit the agent contracts in `docs/agents.md` (drafted)
- [ ] **[Claude]** Scheduling and triggers: calendar poll, form-received, new-comment, payment-received
- [ ] **[Claude]** Error handling, escalation, alerting (what happens when a step fails at 2am)

## Phase 6: Pipeline stages (ops layer; many independent quick wins)

- [x] **[Claude]** Calendar check endpoint: `/api/agents/calendar-check` (GET preview, POST = email digest + Studio ledger entry; reads the calendar's secret iCal address, no OAuth) (done)
- [ ] **[Ridhi]** Paste the calendar's "secret address in iCal format" into `GOOGLE_CALENDAR_ICS_URL` in `.env.local` (instructions in the file)
- [ ] **[Both]** Pick the daily trigger: Hostinger cron hitting the endpoint in production, Windows Task Scheduler locally, or a scheduled cloud agent
- [ ] **[Claude]** Approval-gated provisioning: Drive folder + share intake docs + portal client + credentials email
- [ ] **[Claude]** Intake delivery, collection, parse into compiler config
- [ ] **[Claude]** Build orchestration loop: config, assemble, verify, pass or escalate
- [ ] **[Claude]** Daily comment triage + drafted replies + change-list (draft-then-Ridhi-sends until copy gate relaxes)
- [ ] **[Claude]** Change-implementation loop: apply, verify, ship or escalate
- [ ] **[Claude]** Approval, sign-off docs, final Wave invoice, payment detection
- [ ] **[Claude]** Credential documentation + secure delivery ("rotate before use" enforced) + handoff checklist execution

## Phase 7: Maintenance system (after build pipeline is proven)

- [ ] **[Claude]** Update loop: detect, patch, run harness, green ships / red escalates
- [ ] **[Claude]** Fleet propagation: canary, verify, gradual rollout, automated rollback, human gate for anything not clean-green
- [ ] **[Claude]** Fleet monitoring, uptime, alerting

## Phase 8: Rollout

- [ ] **[Both]** Dogfood end-to-end on a throwaway client with every gate manual
- [ ] **[Ridhi]** Relax gates one at a time per the table above as the harness earns trust

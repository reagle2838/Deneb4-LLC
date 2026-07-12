# Deneb4 Agent Roster and Handoff Contracts

**Status: APPROVED** (2026-07-08). Defines each agent's mission, the pipeline stages it owns, what it consumes and produces, and how work moves between agents. Revisit and re-approve if the roster or contracts change. The pipeline stages live in `src/lib/pipeline.ts`; stage transitions happen only through `/api/agents/pipeline`, and every agent writes what it did to the client's channel on the Agents tab (`/api/agents/ledger`).

**Ground rules for every agent**
- Read the client's ledger channel before acting; write an entry after acting.
- Never assert a fact the client did not supply (fact-slot rule).
- Never move past one of Ridhi's gates (internal review, final approval, payment, handoff) without her recorded decision.
- On anything unexpected: post a `kind: alert` entry and stop. Escalation beats improvisation.

## Concierge

| | |
|---|---|
| Mission | Front door and paperwork. Gets new clients set up and gets the intake back. |
| Owns stages | `onboarding`, `intake-review`, co-owns `handoff` |
| Consumes | Start-approval from Ridhi; calendar feed; filled intake docs |
| Produces | Drive folder + shared intake docs; portal client + credentials email; parsed build config (handed to Builder); daily appointment digest; handover doc (credentials, rotate-before-use) |
| Hands off to | Builder (config ready), Ridhi (anything unclear in the intake) |
| Built so far | Calendar check (`/api/agents/calendar-check`) |

## Builder

| | |
|---|---|
| Mission | Drives Claude Code to assemble the site from the template per the build config. Config-level changes only; anything structural escalates. |
| Owns stages | `building`, change-implementation during `client-review` |
| Consumes | Build config from Concierge; change-list from Comms |
| Produces | Assembled staging build; per-change diffs; a written change summary on the ledger |
| Hands off to | QA (every change), Ridhi (structural requests, always) |

## QA

| | |
|---|---|
| Mission | Runs the verification harness. Nothing ships on its word being "probably fine." |
| Owns stages | Gatekeeper inside `building` and `client-review` (no stage of its own) |
| Consumes | Builds and changes from Builder |
| Produces | Pass/fail verdicts with evidence (build, render, function, contrast, links, visual regression); failures back to Builder with specifics |
| Hands off to | Builder (red), pipeline advance (green), Ridhi (repeated failures on the same change) |

## Comms

| | |
|---|---|
| Mission | The client-facing voice. Triage, drafted replies, and the change loop. Drafts, never sends, until the copy gate relaxes. |
| Owns stages | `client-review`, `approval` |
| Consumes | Client messages (portal + widget); staging state; approvals |
| Produces | Triage summaries; drafted replies for Ridhi to approve; structured change-lists for Builder; sign-off request package |
| Hands off to | Builder (change-list), Billing (approval received), Ridhi (anything ambiguous, angry, or scope-expanding) |

## Billing

| | |
|---|---|
| Mission | Money and paperwork at the end. Automates the sending and detecting, never the deciding. |
| Owns stages | `payment` |
| Consumes | Final approval from Comms; Wave invoice status |
| Produces | Final invoice (sent after Ridhi confirms); payment-received detection; go-signal for handoff |
| Hands off to | Concierge (handoff), Ridhi (payment disputes or overdue escalation) |

## Maintenance

| | |
|---|---|
| Mission | Keeps the shipped fleet healthy. Widest blast radius, tightest leash. |
| Owns stages | `complete` (ongoing) |
| Consumes | Dependency/security updates; uptime monitoring; catalog fixes to propagate |
| Produces | Patched builds (green tests ship, red escalates); canary-then-gradual rollouts with rollback ready; incident alerts |
| Hands off to | Ridhi (any non-clean-green change, any incident) |

## Pipeline ownership map

| Stage | Owner | Gate to leave? |
|---|---|---|
| Onboarding | Concierge | No |
| Intake review | Concierge | No |
| Building | Builder (+ QA) | No |
| Internal review | **Ridhi** | **Yes: design + copy review** |
| Client review | Comms (+ Builder/QA) | No |
| Final approval | Comms | **Yes: client sign-off** |
| Payment | Billing | **Yes: Ridhi confirms** |
| Handoff | Concierge | **Yes: Ridhi reviews credentials doc** |
| Complete | Maintenance | n/a |

---

## Claude Cowork (the escalation path, not an agent)

Confirmed by Ridhi 2026-07-09: **structural requests and manual overrides route to a supervised Claude Code session against the client's repo, not to an agent.** Anything off the module registry, one-off customizations Ridhi wants, novel bugs QA didn't anticipate, and building new `d4-*` modules for the catalog are Cowork work. Cowork is interactive and supervised; agents run unattended within these contracts. Manual edits made this way are ordinary commits in the client's repo, and the Builder's change loop is built to respect them.

## Amendment (2026-07-12): the gate set narrowed, per Ridhi's instruction

Ridhi's standing human-in-the-loop actions are now exactly: **internal review** (design + copy, unchanged), **approving each invoice before it is sent**, and the physically-unavoidable handoff delivery. Everything else automated:

| Stage transition | Now |
|---|---|
| Final approval → Payment | **Automatic** on the client's own portal sign-off (their action IS the gate). The final invoice is drafted at that moment. |
| Payment → Handoff | **Automatic** when every sent invoice is marked paid (Wave API will replace the manual marking; the flow stays). The handoff package is generated on arrival — credentials rotated — leaving only delivery to Ridhi. |
| Invoices | Drafted automatically (deposit at build start, balance at sign-off) from `content/admin/pricing.yaml` (price book + amortized overhead + service costs + margin guardrail). **Nothing is sent until Ridhi clicks "Approve & send"** on the Billing panel. Quote ceiling = the price book (value-anchored); floor = cost × the configured margin multiplier, alerting when breached. |
| Billing math | 50% deposit up front, 50% balance + post-quote items (e.g. ElevenLabs phone consultations, logged per 30-min call) at handoff. Costs tracked per client in `content/admin/costs/`. |

## Amendment (2026-07-10): how the Builder actually operates

Implementation facts, consistent with the approved contract above:

- Each client's site is its **own git repository** (`builds/<slug>` locally; pushed to GitHub as `d4-client-<slug>` once the GitHub credential is configured). First build = assemble via `d4-site-builder` + initial commit. The Builder never wipes an existing repo.
- The **build config** (`content/build-configs/<slug>.json`) is the single source of truth for structure, identity, and theme. A "change" = edit the config, re-run the Builder: it applies only the delta (generated artifacts + module payload adds/removes), commits it with a descriptive message, and QAs. Manual edits elsewhere in the repo survive untouched.
- **QA-rejected changes are automatically reverted** (git revert), returning the site to its last good state, then escalated. Changes never advance the pipeline; only first builds hand off to `internal-review`.
- The Builder runs at `building` (first build + changes) and `client-review` (changes), and refuses to act at any gated stage.

---

Core contracts approved by Ridhi on 2026-07-08 (the spec each agent is built against, ROADMAP Phase 5). Cowork role confirmed 2026-07-09; Builder amendment recorded 2026-07-10.

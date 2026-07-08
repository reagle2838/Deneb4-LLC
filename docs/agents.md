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

Approved by Ridhi on 2026-07-08. These contracts are the spec each agent is built against (ROADMAP Phase 5).

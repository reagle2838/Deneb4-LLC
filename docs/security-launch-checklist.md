# Security & Launch Checklist

The pre-launch flip list. Everything here must be true before a real,
paying client with real data and real money touches the system. Grouped by
who closes it. Last audited 2026-07-14.

## Ridhi must do these before launch (they cannot be automated)

- [ ] **Turn CMS auth back on.** Remove `CMS_AUTH_DISABLED=true` from
  `.env.local` (or set it to anything but `true`). While it's on, the entire
  `/cms-admin` Workspace and every CMS-only API route is open with no
  password, and the "agents propose, Ridhi disposes" boundary is off (any
  request reads as an authenticated owner). The Agents tab shows a warning
  badge whenever this flag is set. *(Defense-in-depth already in place: even
  if this flag leaks into the production environment it is INERT there — the
  bypass is hard-gated to `NODE_ENV !== 'production'`. But turn it off in dev
  too before launch so you're testing the real gates.)*
- [ ] **Complete the CMS 2FA setup, then remove `KEYSTATIC_SETUP=true`.** That
  flag is only for the one-time authenticator QR scan; leaving it set is a
  standing risk.
- [ ] **Set strong, unique production secrets** (do NOT reuse dev values):
  `CMS_JWT_SECRET` (signs both Workspace and client-portal sessions — a weak
  one forges any session), `KEYSTATIC_PASSWORD`, `KEYSTATIC_TOTP_SECRET`,
  `AGENT_API_KEY` (the headless-agent key; treat like a password).
- [ ] **Verify the Resend sending domain** (DNS records for deneb4.com) and set
  `CONTACT_FROM_EMAIL` to a verified address, so client email actually sends
  instead of console-logging.
- [ ] **Confirm `.env.local` (and any real `.env`) is never committed.** It's
  gitignored; keep it that way. Production secrets live in Vercel's own
  project environment-variable settings (the decided host as of 2026-07-15),
  not in a file in the repo.
- [x] **HTTPS in production.** Solved by hosting choice: Vercel terminates TLS
  automatically on every deploy, including preview URLs — no cert to manage.
- [ ] **Confirm the Wave token's scope** the first time a real invoice is
  created end to end. The integration is verified working; just make sure the
  token can read/write invoices for the Deneb4 business (not a read-only or
  personal-scope token).

## Already fixed in code (2026-07-14 security pass) — no action needed, noted for the record

- [x] **Timing-safe agent-key comparison.** All 8 agent/clients API routes now
  compare `x-agent-key` against `AGENT_API_KEY` with
  `crypto.timingSafeEqual` via one shared `hasAgentKey()` helper
  (`src/lib/agent-auth.ts`), not `===` — no character-by-character timing
  leak. Verified: correct key passes, wrong key (same and different length)
  and missing key all rejected.
- [x] **Path-traversal hardening.** Every place a client slug becomes a file
  path (`clients`, `billing`, `costs`, `consultations`, `email-log`,
  `handoff`, `comms` proposals/build-config, `wave`) now validates the slug
  (`isValidSlug`: `^[a-z0-9][a-z0-9-]{0,63}$`) before touching the
  filesystem. A slug like `../../.env` can't escape `content/`. Routes that
  read a slug directly (billing/changes/handoff GET) reject it at the
  boundary with a clean 400; everything funneling through `getClientBySlug`
  gets a clean 404. Verified with live traversal attempts.
- [x] **`CMS_AUTH_DISABLED` production kill-switch.** The dev bypass is gated to
  `NODE_ENV !== 'production'`, so the flag can never silently open a
  production Workspace even if it leaks into the host env.
- [x] **Wave/secret handling.** Wave account state under
  `content/admin/wave/` holds only customer/product IDs (not secrets) and is
  gitignored. No API token or client secret is ever logged; the Wave library
  reads them from env at call time only.

## Already sound (verified during the audit, no change needed)

- Client portal + widget are correctly scoped: `portal-*` routes derive the
  client from the signed `portal_session` cookie (never a client-supplied
  slug), and the widget authorizes by the per-client secret key. One client
  cannot read or act on another's data.
- The ledger channel validator (`isValidChannel`) already blocked traversal
  on ledger files.
- Handoff packages (which contain a live rotated credential) are CMS-only in
  both directions and written to a gitignored directory.
- Invoice-send and change-application remain behind Ridhi's gates; agents
  propose, Ridhi approves.

## Operational, before or at launch

- [ ] Point the heartbeat scheduler at production (`register-heartbeat-task.ps1`
  locally, or a scheduled cloud job / Vercel Cron hitting `POST /api/agents/tick`
  once the studio app itself is deployed there).
- [ ] Decide the incident-response plan for a live client's site going down
  (the maintenance uptime watch alerts you; who acts, how fast?).
- [ ] Run one full dogfood cycle on a throwaway client with real deploy, real
  invoice, real payment before onboarding a paying one.

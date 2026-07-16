# The Google Apps Script bridge (both directions)

Two systems, one client lifecycle: the Apps Script document engine (intake form,
scope/handoff docs, sign-and-lock PDFs, the Project Matrix sheet) and the Deneb4
agent pipeline. Phase 11 wired GAS → Deneb4; Phase 14 wires Deneb4 → GAS so
agents can drive the document engine without a human relay.

## Direction 1: GAS → Deneb4 (live since Phase 11)

Your Apps Script already POSTs five events to `/api/agents/intake-webhook`
(auth: `x-agent-key`): `intake_submitted`, `onboarding_signed`, **`quote_signed`
(new — see below)**, `handoff_sent`, `handoff_signed`.

**New in Phase 14 — the Quote Authorization Form.** If you add a third
sign-off form for quotes (recommended: it e-signs and PDF-locks the quote
exactly like the scope doc), have its submit trigger call your existing
`sendToDeneb4` helper with:

```js
sendToDeneb4({ event: 'quote_signed', email: clientEmail });
```

That is the client's quote confirmation: Deneb4 applies the confirmed scope as
the build config and drafts the deposit invoice. (Clients without the form can
confirm through their portal instead — both paths run the same code.)

### Portal credentials (fixed 2026-07-16 — read this before touching your welcome email)

`intake_submitted` used to hand the generated password back in the API
response and rely on your Apps Script's own welcome email to include it —
an unverifiable dependency: if that email didn't carry the password, the
client had no way into their portal, and the client NEEDS portal access
immediately (it's how they read and confirm their quote).

**Deneb4 now sends the portal welcome email itself**, directly, the moment
the client record is created — a path that's actually tested and confirmed
delivering. The `intake_submitted` response still includes `password` and
`credentialsEmailed` (true/false) so your script can log or alert if it
ever comes back false, but **your own welcome email should not repeat the
raw password** — two independent emails with the same live credential is a
real leak surface. Keep your email focused on what's uniquely yours (their
Drive folder link, the scope document, next steps) and let Deneb4 own
credential delivery.

## Direction 2: Deneb4 → GAS (new, Phase 14)

### One-time setup (you, ~5 minutes)

1. In the Apps Script editor, add the `doPost` handler below to the lifecycle
   script project.
2. Script Properties: add `DENEB4_BRIDGE_SECRET` = a long random string.
3. Deploy → New deployment → Web app → Execute as **Me**, access **Anyone**.
   Copy the `/exec` URL.
4. In the studio app's `.env.local`: set `GAS_WEBAPP_URL` to that URL and
   `GAS_SHARED_SECRET` to the same random string.

Until both env vars are set the bridge is dormant and every call is a recorded
no-op — nothing breaks.

### What agents send

| Action | When | Suggested handling in your script |
|---|---|---|
| `quote_approved` | Ridhi approved the quote | Update the Matrix row (e.g. "Quote sent") |
| `quote_confirmed` | Client confirmed the quote | Update the Matrix row ("Quote signed / deposit invoiced") |
| `build_started` | Deposit settled; Builder running | Update the Matrix row ("In Progress") |
| `send_handoff_doc` | Client reached Final approval | **Call your existing handoff-doc function** (the one behind the sheet menu) for this client — no more manual menu click |
| `project_paid` | Every invoice settled | Update the Matrix row ("Paid in full") |
| `project_complete` | Pipeline archived | Update the Matrix row ("Project Complete") |

Every payload carries `secret`, `action`, `slug`, and usually `email`/`name`.

### The doPost handler (paste into the lifecycle script)

```js
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput('bad request').setMimeType(ContentService.MimeType.TEXT);
  }
  if (!body.secret || body.secret !== props.getProperty('DENEB4_BRIDGE_SECRET')) {
    return ContentService.createTextOutput('unauthorized').setMimeType(ContentService.MimeType.TEXT);
  }

  switch (body.action) {
    case 'quote_approved':
      updateMatrixStatusByEmail_(body.email, 'Quote sent');
      break;
    case 'quote_confirmed':
      updateMatrixStatusByEmail_(body.email, 'Quote signed — deposit invoiced');
      break;
    case 'build_started':
      updateMatrixStatusByEmail_(body.email, 'In Progress');
      break;
    case 'send_handoff_doc':
      // Reuse the function your custom menu calls today, keyed by email
      // instead of the active row. Adapt the name to your script.
      triggerHandoffByEmail_(body.email);
      break;
    case 'project_paid':
      updateMatrixStatusByEmail_(body.email, 'Paid in full');
      break;
    case 'project_complete':
      updateMatrixStatusByEmail_(body.email, 'Project Complete');
      break;
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

// Helpers to implement against your Matrix sheet's real columns:
//   updateMatrixStatusByEmail_(email, status)  — find the client's row by
//     email, set the status cell.
//   triggerHandoffByEmail_(email) — locate the row, then run the same logic
//     as your triggerHandoffFromActiveRow menu item against that row.
```

### Production prerequisite

GAS can only reach a public URL. Until the studio app has its production
deploy, this direction works only when tested from a machine GAS can reach —
the outbound calls no-op harmlessly in local dev unless you tunnel.

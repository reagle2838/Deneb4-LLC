import path from 'path';
import fs from 'fs';
import {
  slugify,
  clientExists,
  writeClient,
  getClientBySlug,
  setDriveFolderIfEmpty,
  EMPTY_STAGING,
  generateWidgetKey,
  type Client,
} from './clients';
import { generateClientPassword, hashPassword } from './portal-auth';
import { appendLedger } from './agent-ledger';
import { notifyOwnerOfAgentAlert, notifyClientCredentials } from './notify';
import { setPipelineStage } from './clients';
import { recordClientSignoff, SIGNOFF_PHASE } from './signoff';
import { draftQuote, quoteTotal } from './quotes';
import { money } from './pricing';
import { runMapping, type FieldMapping } from '../../packages/field-mapping/index.mjs';

/**
 * Intake ingestion: the bridge from a submitted questionnaire (our own
 * /intake form, or the legacy Google Form webhook shape) into the Deneb4
 * pipeline. This module only records what happened and stages a PROPOSED
 * build config — Ridhi reviews before anything is built.
 *
 * The parsing itself is fully declarative: content/admin/intake-mapping.json
 * (a stardrive-field-mapping/v1 document) maps the questionnaire's stable
 * Q-codes onto build-config slots, decision flags, notes, and the context
 * bundle, executed by packages/field-mapping. scripts/parse-intake.mjs (the
 * CSV path) runs the SAME mapping — when the questionnaire changes, edit the
 * mapping file; no parser code changes, no drift between the two paths.
 * Parity with the original hand-written parser is regression-tested by
 * scripts/test-field-mapping.mjs against captured golden outputs.
 */

const INTAKE_DIR = path.join(process.cwd(), 'content', 'admin', 'intake');
const MAPPING_PATH = path.join(process.cwd(), 'content', 'admin', 'intake-mapping.json');

type Responses = Record<string, string[] | string | undefined>;

/** Read fresh each time — intakes are rare and the mapping must never be stale. */
function loadIntakeMapping(): FieldMapping {
  return JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf-8')) as FieldMapping;
}

interface StagedIntake {
  slug: string;
  config: Record<string, unknown>;
  clientContact: { name: string; email: string; phone: string };
  flags: Record<string, unknown>;
  unmapped: string[];
  notes: string[];
  context: Record<string, string>;
  mapReport: { field: string; code: string; how: string }[];
  source: string;
  stagedAt: string;
}

/** Run the mapping over raw form answers and stage the result. Never applies it. */
function parseAndStage(responses: Responses, driveFolderUrl: string): StagedIntake {
  const result = runMapping(loadIntakeMapping(), responses);
  const notes = [...result.notes];
  if (driveFolderUrl) notes.push(`Drive folder: ${driveFolderUrl}`);
  const slug = slugify((result.config.siteName as string) || `intake-${Date.now()}`);
  return {
    slug,
    config: result.config,
    clientContact: {
      name: result.contact.name ?? '',
      email: result.contact.email ?? '',
      phone: result.contact.phone ?? '',
    },
    flags: result.flags,
    unmapped: result.unmapped,
    notes,
    context: result.context,
    mapReport: result.mapReport,
    source: 'intake-form',
    stagedAt: new Date().toISOString(),
  };
}

// ── Event: intake_submitted ──────────────────────────────────────────────
export interface IntakeSubmittedResult {
  slug: string;
  portalUrl: string;
  password?: string;
  widgetKey: string;
  created: boolean;
  /** True when Deneb4's own credentials email was sent and delivered. */
  credentialsEmailed: boolean;
}

export async function handleIntakeSubmitted(input: {
  responses: Responses;
  driveFolderUrl?: string;
  siteUrl: string;
}): Promise<IntakeSubmittedResult> {
  const staged = parseAndStage(input.responses, input.driveFolderUrl ?? '');
  const name = staged.clientContact.name || staged.config.siteName as string || staged.slug;
  const email = staged.clientContact.email || (staged.config.contactEmail as string) || '';

  const slug = staged.slug;
  let password: string | undefined;
  let created = false;
  let credentialsEmailed = false;

  if (!clientExists(slug)) {
    password = generateClientPassword();
    const widgetKey = generateWidgetKey();
    writeClient(slug, {
      passwordHash: hashPassword(password),
      data: {
        name, email, phone: staged.clientContact.phone || '', internalNotes: '',
        projectName: (staged.config.siteName as string) || name,
        active: true, stage: '', driveFolder: input.driveFolderUrl ?? '',
        updates: [], files: [], revisions: [], invoices: [], staging: EMPTY_STAGING,
        feedbackOpen: false, feedback: [], widgetKey, lastSeenByClient: '',
        pipeline: 'onboarding', draftReplies: [], githubUser: (staged.flags.githubUser as string) || '',
      },
    });
    created = true;
    // Send the portal credentials from Deneb4 directly — reliable and
    // already verified end to end — rather than depending on the Apps
    // Script side's own welcome email to have included the password. The
    // client needs portal access well before any decision to proceed: it's
    // how they read the drafted quote and confirm it (Phase 14 gate #1).
    const freshClient = await getClientBySlug(slug);
    if (freshClient) {
      credentialsEmailed = await notifyClientCredentials(freshClient, password, 'welcome');
    }
    appendLedger(slug, {
      agent: 'concierge',
      kind: 'event',
      message: `Client created from the live intake form. Drive folder + build config staged. Pipeline starts at Onboarding. Portal credentials ${credentialsEmailed ? 'emailed to the client' : 'NOT delivered by email (check RESEND_API_KEY / CONTACT_FROM_EMAIL) — share them manually'}.`,
      data: { email },
    });
  } else if (input.driveFolderUrl) {
    // Resubmission or a form-answer edit on an already-known client: don't
    // clobber a manually-set folder link, only fill it in if it's blank.
    setDriveFolderIfEmpty(slug, input.driveFolderUrl);
  }

  // Stage the proposed build config for Ridhi's review (never auto-applied).
  fs.mkdirSync(INTAKE_DIR, { recursive: true });
  fs.writeFileSync(path.join(INTAKE_DIR, `${slug}.json`), JSON.stringify(staged, null, 2));

  // Phase 14 gate #1: the quote drafts itself from the staged config the
  // moment intake lands, so Ridhi's first touch is approve/deny — not
  // "compute a price".
  const quote = draftQuote(slug, 'agent');

  appendLedger(slug, {
    agent: 'concierge',
    kind: 'event',
    message: `Intake received via the live intake form. Build config staged for your review (content/admin/intake/${slug}.json). ${staged.unmapped.length ? `Missing: ${staged.unmapped.join(', ')}.` : 'All fields mapped.'}${quote ? ` Quote drafted (${money(quoteTotal(quote))}) — approve or deny it on the Quote panel.` : ''} Awaiting the client's onboarding signature.`,
  });

  return {
    slug,
    portalUrl: `${input.siteUrl.replace(/\/$/, '')}/login`,
    password,
    widgetKey: (await getClientBySlug(slug))?.widgetKey ?? '',
    created,
    credentialsEmailed,
  };
}

// ── Event: onboarding_signed ──────────────────────────────────────────────
export async function handleOnboardingSigned(email: string): Promise<{ slug: string } | null> {
  const client = await findClientByEmail(email);
  if (!client) return null;
  setPipelineStage(client.slug, 'intake-review');
  const msg = `Client signed the onboarding authorization (via the Google Workspace flow). Build config is staged and ready for your review — apply it (npm run intake -- --slug ${client.slug} --apply) then run the Builder when ready.`;
  appendLedger(client.slug, { agent: 'concierge', kind: 'decision', message: msg });
  await notifyOwnerOfAgentAlert(client.slug, 'concierge', msg);
  return { slug: client.slug };
}

// ── Event: handoff_sent (Ridhi's own toolbar click) ──────────────────────
export async function handleHandoffSent(input: { email?: string; slug?: string }): Promise<{ slug: string } | null> {
  const client = input.slug ? await getClientBySlug(input.slug) : await findClientByEmail(input.email ?? '');
  if (!client) return null;
  setPipelineStage(client.slug, 'approval');
  appendLedger(client.slug, {
    agent: 'concierge',
    kind: 'event',
    message: `Final approval requested (via your Handoff Document automation). Awaiting the client's signature on the Handoff Authorization Form.`,
  });
  return { slug: client.slug };
}

// ── Event: handoff_signed (client's final sign-off) ──────────────────────
export async function handleHandoffSigned(email: string): Promise<{ slug: string; advanced: boolean } | null> {
  const client = await findClientByEmail(email);
  if (!client) return null;
  const advanced = await recordClientSignoff(client, SIGNOFF_PHASE);
  return { slug: client.slug, advanced };
}

async function findClientByEmail(email: string): Promise<Client | null> {
  if (!email) return null;
  const { getClientByEmail } = await import('./clients');
  return getClientByEmail(email);
}

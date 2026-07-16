import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { isValidSlug } from './agent-auth';

export function generateWidgetKey(): string {
  return crypto.randomBytes(9).toString('hex'); // 18-char unguessable key
}

export interface ClientUpdate {
  phase: string;
  status: 'upcoming' | 'in-progress' | 'pending-signoff' | 'complete';
  notes: string;
  date: string;
}

export interface ClientFile {
  name: string;
  url: string;
  description: string;
  date: string;
}

export interface ClientRevision {
  phase: string;
  description: string;
  status: 'requested' | 'in-progress' | 'complete';
  date: string;
}

export interface ClientInvoice {
  description: string;
  amount: string;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  invoiceUrl?: string;
}

export interface ClientStaging {
  url: string;
  username: string;
  password: string;
  status: 'building' | 'ready' | 'live' | 'down';
  notes: string;
}

export const EMPTY_STAGING: ClientStaging = {
  url: '',
  username: '',
  password: '',
  status: 'building',
  notes: '',
};

export interface ClientFeedback {
  id: string;
  author: 'client' | 'deneb4';
  message: string;
  page: string; // which page/area of the staging site (client comments)
  date: string; // ISO timestamp
  read: boolean; // read by Deneb4 (for the unread badge)
  resolved: boolean; // archived to history once the issue is handled
}

/**
 * A proposed owner reply awaiting Ridhi's approval (the copy-review gate).
 * Kept in a SEPARATE array from `feedback` so it can never leak to the
 * client: the portal and widget only ever read `feedback`. On approval a
 * draft becomes a real `feedback` reply and the client is emailed.
 */
export interface DraftReply {
  id: string;
  message: string;
  page: string;
  createdBy: string; // agent id that proposed it ('comms', 'ridhi', ...)
  date: string; // ISO timestamp
}

export { BUILD_STAGES } from './stages';

export interface Client {
  slug: string;
  name: string;
  email: string;
  phone: string; // client's phone number (consultations, follow-ups)
  internalNotes: string; // Ridhi's private notes: how they found us, context, reminders. Never shown to the client.
  projectName: string;
  active: boolean;
  passwordHash: string;
  stage: string;
  driveFolder: string;
  updates: ClientUpdate[];
  files: ClientFile[];
  revisions: ClientRevision[];
  invoices: ClientInvoice[];
  staging: ClientStaging;
  feedbackOpen: boolean; // whether the client can leave feedback in their portal
  feedback: ClientFeedback[];
  widgetKey: string; // per-client key embedded in the staging-site feedback widget
  lastSeenByClient: string; // ISO timestamp: when the client last viewed the thread
  pipeline: string; // internal pipeline stage id (see lib/pipeline.ts); '' = legacy/unset
  draftReplies: DraftReply[]; // proposed replies awaiting Ridhi's approval (never sent to client)
  githubUser: string; // client's GitHub username, for repo transfer at handoff (optional)
}

/** Editable portion of a client (everything except slug + passwordHash). */
export type ClientData = Omit<Client, 'slug' | 'passwordHash'>;

const CLIENTS_DIR = path.join(process.cwd(), 'content', 'clients');

// Reject any slug that could escape the clients directory (path traversal)
// before it ever reaches the filesystem. Every route that takes a slug from
// the request funnels through getClientBySlug → parseFile, so validating
// here closes the traversal vector for the whole app: a bad slug reads as
// "client not found" (clean 404) rather than reaching outside content/.
function clientPath(slug: string): string {
  if (!isValidSlug(slug)) throw new Error('Invalid client slug.');
  return path.join(CLIENTS_DIR, `${slug}.yaml`);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function clientExists(slug: string): boolean {
  if (!isValidSlug(slug)) return false;
  return fs.existsSync(clientPath(slug));
}

type RawClient = Record<string, unknown>;

function asArray(v: unknown): RawClient[] {
  return Array.isArray(v) ? (v as RawClient[]) : [];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseFile(slug: string): Client | null {
  if (!isValidSlug(slug)) return null; // unsafe slug → treated as not found
  const filePath = clientPath(slug);
  if (!fs.existsSync(filePath)) return null;
  const data = (yamlLoad(fs.readFileSync(filePath, 'utf-8')) ?? {}) as RawClient;

  return {
    slug,
    name: str(data.name) || slug,
    email: str(data.email),
    phone: str(data.phone),
    internalNotes: str(data.internalNotes),
    projectName: str(data.projectName),
    active: data.active === true,
    passwordHash: str(data.passwordHash),
    stage: str(data.stage),
    driveFolder: str(data.driveFolder),
    updates: asArray(data.updates).map((u) => ({
      phase: str(u.phase),
      status: (str(u.status) || 'upcoming') as ClientUpdate['status'],
      notes: str(u.notes),
      date: str(u.date),
    })),
    files: asArray(data.files).map((f) => ({
      name: str(f.name),
      url: str(f.url),
      description: str(f.description),
      date: str(f.date),
    })),
    revisions: asArray(data.revisions).map((r) => ({
      phase: str(r.phase),
      description: str(r.description),
      status: (str(r.status) || 'requested') as ClientRevision['status'],
      date: str(r.date),
    })),
    invoices: asArray(data.invoices).map((i) => ({
      description: str(i.description),
      amount: str(i.amount),
      status: (str(i.status) || 'pending') as ClientInvoice['status'],
      dueDate: str(i.dueDate),
      ...(str(i.invoiceUrl) ? { invoiceUrl: str(i.invoiceUrl) } : {}),
    })),
    staging: parseStaging(data.staging),
    feedbackOpen: data.feedbackOpen === true,
    feedback: asArray(data.feedback).map((m) => ({
      id: str(m.id),
      author: (str(m.author) === 'deneb4' ? 'deneb4' : 'client') as ClientFeedback['author'],
      message: str(m.message),
      page: str(m.page),
      date: str(m.date),
      read: m.read === true,
      resolved: m.resolved === true,
    })),
    widgetKey: str(data.widgetKey),
    lastSeenByClient: str(data.lastSeenByClient),
    pipeline: str(data.pipeline),
    draftReplies: asArray(data.draftReplies).map((d) => ({
      id: str(d.id),
      message: str(d.message),
      page: str(d.page),
      createdBy: str(d.createdBy) || 'comms',
      date: str(d.date),
    })),
    githubUser: str(data.githubUser),
  };
}

function parseStaging(v: unknown): ClientStaging {
  const s = (v && typeof v === 'object' ? v : {}) as RawClient;
  return {
    url: str(s.url),
    username: str(s.username),
    password: str(s.password),
    status: (str(s.status) || 'building') as ClientStaging['status'],
    notes: str(s.notes),
  };
}

export async function getAllClients(): Promise<Client[]> {
  if (!fs.existsSync(CLIENTS_DIR)) return [];
  return fs
    .readdirSync(CLIENTS_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parseFile(f.replace(/\.yaml$/, '')))
    .filter((c): c is Client => c !== null);
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  return parseFile(slug);
}

export async function getClientByEmail(email: string): Promise<Client | null> {
  const clients = await getAllClients();
  return clients.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null;
}

/** Look up a client by their staging-widget key. */
export async function getClientByWidgetKey(key: string): Promise<Client | null> {
  if (!key) return null;
  const clients = await getAllClients();
  return clients.find((c) => c.widgetKey && c.widgetKey === key) ?? null;
}

/** Generate (or regenerate) a client's widget key and persist it. Returns the key. */
export function setWidgetKey(slug: string): string | null {
  const c = parseFile(slug);
  if (!c) return null;
  const key = generateWidgetKey();
  const data = clientToData(c);
  data.widgetKey = key;
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return key;
}

/** Write a full client record to disk. Creates the directory if needed. */
export function writeClient(
  slug: string,
  client: { data: ClientData; passwordHash: string }
): void {
  if (!fs.existsSync(CLIENTS_DIR)) fs.mkdirSync(CLIENTS_DIR, { recursive: true });
  const { data, passwordHash } = client;
  const out = {
    name: data.name,
    email: data.email,
    phone: data.phone ?? '',
    internalNotes: data.internalNotes ?? '',
    projectName: data.projectName,
    active: data.active,
    passwordHash,
    stage: data.stage,
    driveFolder: data.driveFolder,
    updates: data.updates,
    files: data.files,
    revisions: data.revisions,
    invoices: data.invoices,
    staging: data.staging ?? EMPTY_STAGING,
    feedbackOpen: data.feedbackOpen ?? false,
    feedback: data.feedback ?? [],
    widgetKey: data.widgetKey ?? '',
    lastSeenByClient: data.lastSeenByClient ?? '',
    pipeline: data.pipeline ?? '',
    draftReplies: data.draftReplies ?? [],
    githubUser: data.githubUser ?? '',
  };
  fs.writeFileSync(clientPath(slug), yamlDump(out, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

export function deleteClient(slug: string): boolean {
  const filePath = clientPath(slug);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

function clientToData(c: Client): ClientData {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { slug: _slug, passwordHash: _passwordHash, ...rest } = c;
  return rest;
}

/** Replace a client's invoice list (Billing agent, after Ridhi approves a send). */
export function setInvoices(slug: string, invoices: ClientInvoice[]): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  data.invoices = invoices;
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Set a client's GitHub username (for repo transfer at handoff). */
export function setGithubUser(slug: string, githubUser: string): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  data.githubUser = githubUser.trim().replace(/^@/, '');
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Merge fields into a client's staging block (deploy automation). */
export function setStaging(slug: string, patch: Partial<ClientStaging>): ClientStaging | null {
  const c = parseFile(slug);
  if (!c) return null;
  const data = clientToData(c);
  data.staging = { ...c.staging, ...patch };
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return data.staging;
}

/** Set the shared Drive folder link, only if it isn't already set (never overwrite a real value). */
export function setDriveFolderIfEmpty(slug: string, url: string): boolean {
  const c = parseFile(slug);
  if (!c || c.driveFolder || !url) return false;
  const data = clientToData(c);
  data.driveFolder = url;
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Add a file entry to the client's portal Files section (deduped by name). */
export function addClientFile(slug: string, file: ClientFile): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  data.files = [...data.files.filter((f) => f.name !== file.name), file];
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Append one update to a client's portal timeline. */
export function appendUpdate(slug: string, update: ClientUpdate): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  data.updates = [...data.updates, update];
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Append one feedback message to a client's thread. */
export function addFeedback(slug: string, entry: ClientFeedback): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  data.feedback = [...data.feedback, entry];
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Mark all of a client's feedback as read by Deneb4. */
export function markFeedbackRead(slug: string): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  data.feedback = data.feedback.map((m) => ({ ...m, read: true }));
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Edit one message's text. Only succeeds if the message author matches. */
export function editFeedback(slug: string, id: string, message: string, author: ClientFeedback['author']): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  let found = false;
  data.feedback = data.feedback.map((m) => {
    if (m.id === id && m.author === author) {
      found = true;
      return { ...m, message };
    }
    return m;
  });
  if (!found) return false;
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Delete one message. Only succeeds if the message author matches. */
export function deleteFeedback(slug: string, id: string, author: ClientFeedback['author']): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  const before = data.feedback.length;
  data.feedback = data.feedback.filter((m) => !(m.id === id && m.author === author));
  if (data.feedback.length === before) return false;
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Archive the active thread to history (mark all current messages resolved). */
export function resolveFeedback(slug: string): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  data.feedback = data.feedback.map((m) => ({ ...m, resolved: true, read: true }));
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Propose a reply for Ridhi to approve. Returns the created draft or null. */
export function addDraftReply(
  slug: string,
  input: { message: string; page?: string; createdBy?: string }
): DraftReply | null {
  const c = parseFile(slug);
  if (!c) return null;
  const draft: DraftReply = {
    id: crypto.randomUUID(),
    message: input.message,
    page: input.page ?? '',
    createdBy: input.createdBy || 'comms',
    date: new Date().toISOString(),
  };
  const data = clientToData(c);
  data.draftReplies = [...data.draftReplies, draft];
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return draft;
}

/** Edit a pending draft's text. */
export function editDraftReply(slug: string, id: string, message: string): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  let found = false;
  data.draftReplies = data.draftReplies.map((d) => {
    if (d.id === id) {
      found = true;
      return { ...d, message };
    }
    return d;
  });
  if (!found) return false;
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Reject/discard a pending draft. */
export function deleteDraftReply(slug: string, id: string): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  const before = data.draftReplies.length;
  data.draftReplies = data.draftReplies.filter((d) => d.id !== id);
  if (data.draftReplies.length === before) return false;
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/**
 * Approve a draft: remove it from drafts, append it to the thread as a real
 * Deneb4 reply, and mark client messages read. Returns { client, entry } so
 * the route can email the client, or null if the draft doesn't exist.
 */
export function approveDraftReply(slug: string, id: string): { client: Client; entry: ClientFeedback } | null {
  const c = parseFile(slug);
  if (!c) return null;
  const draft = c.draftReplies.find((d) => d.id === id);
  if (!draft) return null;
  const entry: ClientFeedback = {
    id: crypto.randomUUID(),
    author: 'deneb4',
    message: draft.message,
    page: '',
    date: new Date().toISOString(),
    read: true,
    resolved: false,
  };
  const data = clientToData(c);
  data.draftReplies = data.draftReplies.filter((d) => d.id !== id);
  data.feedback = [...data.feedback.map((m) => ({ ...m, read: true })), entry];
  writeClient(slug, { data, passwordHash: c.passwordHash });
  const updated = parseFile(slug);
  return updated ? { client: updated, entry } : null;
}

/** Count of pending draft replies across a client (drives the worklist). */
export function countPendingDrafts(client: Client): number {
  return client.draftReplies.length;
}

/**
 * Move a client to a new pipeline stage. Returns { from, to } on success,
 * null if the client doesn't exist. Idempotent: setting the current stage
 * again succeeds without a write. Stage validity is the API route's job.
 */
export function setPipelineStage(slug: string, stage: string): { from: string; to: string } | null {
  const c = parseFile(slug);
  if (!c) return null;
  const from = c.pipeline;
  if (from === stage) return { from, to: stage };
  const data = clientToData(c);
  data.pipeline = stage;
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return { from, to: stage };
}

/** Record that the client has viewed the message thread just now. */
export function markThreadSeenByClient(slug: string): boolean {
  const c = parseFile(slug);
  if (!c) return false;
  const data = clientToData(c);
  data.lastSeenByClient = new Date().toISOString();
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return true;
}

/** Studio replies the client has not seen yet (drives the portal unread dot). */
export function countUnreadForClient(client: Client): number {
  return client.feedback.filter(
    (m) =>
      m.author === 'deneb4' &&
      !m.resolved &&
      (!client.lastSeenByClient || m.date > client.lastSeenByClient)
  ).length;
}

/** Client messages the studio has not read yet (drives the Workspace badge). */
export function countUnreadForOwner(client: Client): number {
  return client.feedback.filter((m) => m.author === 'client' && !m.read && !m.resolved).length;
}

/**
 * Client-side approval of a pending-signoff update. The index + phase echo
 * guards against the list changing between render and click. Flips the
 * update to complete and returns the updated client, or null if the
 * update no longer exists or is not awaiting sign-off.
 */
export function approveUpdate(slug: string, index: number, phase: string): Client | null {
  const c = parseFile(slug);
  if (!c) return null;
  const target = c.updates[index];
  if (!target || target.phase !== phase || target.status !== 'pending-signoff') return null;
  const data = clientToData(c);
  data.updates = c.updates.map((u, i) => (i === index ? { ...u, status: 'complete' as const } : u));
  writeClient(slug, { data, passwordHash: c.passwordHash });
  return parseFile(slug);
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

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

export { BUILD_STAGES } from './stages';

export interface Client {
  slug: string;
  name: string;
  email: string;
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
}

/** Editable portion of a client (everything except slug + passwordHash). */
export type ClientData = Omit<Client, 'slug' | 'passwordHash'>;

const CLIENTS_DIR = path.join(process.cwd(), 'content', 'clients');

function clientPath(slug: string): string {
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
  const filePath = clientPath(slug);
  if (!fs.existsSync(filePath)) return null;
  const data = (yamlLoad(fs.readFileSync(filePath, 'utf-8')) ?? {}) as RawClient;

  return {
    slug,
    name: str(data.name) || slug,
    email: str(data.email),
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

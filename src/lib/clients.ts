import fs from 'fs';
import path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

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

export interface Client {
  slug: string;
  name: string;
  email: string;
  projectName: string;
  active: boolean;
  passwordHash: string;
  updates: ClientUpdate[];
  files: ClientFile[];
  revisions: ClientRevision[];
  invoices: ClientInvoice[];
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

/** Write a full client record to disk. Creates the directory if needed. */
export function writeClient(slug: string, client: { data: ClientData; passwordHash: string }): void {
  if (!fs.existsSync(CLIENTS_DIR)) fs.mkdirSync(CLIENTS_DIR, { recursive: true });
  const { data, passwordHash } = client;
  const out = {
    name: data.name,
    email: data.email,
    projectName: data.projectName,
    active: data.active,
    passwordHash,
    updates: data.updates,
    files: data.files,
    revisions: data.revisions,
    invoices: data.invoices,
  };
  fs.writeFileSync(clientPath(slug), yamlDump(out, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

export function deleteClient(slug: string): boolean {
  const filePath = clientPath(slug);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

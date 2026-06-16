import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';

const reader = createReader(process.cwd(), keystaticConfig);

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

type RawEntry = Awaited<ReturnType<typeof reader.collections.clients.read>>;

function parseEntry(slug: string, entry: RawEntry): Client | null {
  if (!entry) return null;
  return {
    slug,
    name: entry.name,
    email: entry.email,
    projectName: entry.projectName,
    active: entry.active,
    passwordHash: entry.passwordHash,
    updates: (entry.updates ?? []).map((u) => ({
      phase: u.phase,
      status: u.status as ClientUpdate['status'],
      notes: u.notes,
      date: u.date ?? '',
    })),
    files: (entry.files ?? []).map((f) => ({
      name: f.name,
      url: f.url,
      description: f.description,
      date: f.date ?? '',
    })),
    revisions: (entry.revisions ?? []).map((r) => ({
      phase: r.phase,
      description: r.description,
      status: r.status as ClientRevision['status'],
      date: r.date ?? '',
    })),
    invoices: (entry.invoices ?? []).map((i) => ({
      description: i.description,
      amount: i.amount,
      status: i.status as ClientInvoice['status'],
      dueDate: i.dueDate ?? '',
      ...(i.invoiceUrl ? { invoiceUrl: i.invoiceUrl } : {}),
    })),
  };
}

export async function getAllClients(): Promise<Client[]> {
  const slugs = await reader.collections.clients.list();
  const clients: Client[] = [];
  for (const slug of slugs) {
    const entry = await reader.collections.clients.read(slug);
    const client = parseEntry(slug, entry);
    if (client) clients.push(client);
  }
  return clients;
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  const entry = await reader.collections.clients.read(slug);
  return parseEntry(slug, entry);
}

export async function getClientByEmail(email: string): Promise<Client | null> {
  const clients = await getAllClients();
  return clients.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null;
}

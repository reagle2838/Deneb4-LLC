'use client';

import { useState } from 'react';
import type {
  Client,
  ClientData,
  ClientStaging,
  ClientUpdate,
  ClientFile,
  ClientRevision,
  ClientInvoice,
} from '@/lib/clients';

// Local copy of EMPTY_STAGING: '@/lib/clients' is server-only (fs) and
// cannot be imported for values from a client component.
const EMPTY_STAGING: ClientStaging = { url: '', username: '', password: '', status: 'building', notes: '' };

export function toData(c: Client): ClientData {
  return {
    name: c.name,
    email: c.email,
    projectName: c.projectName,
    active: c.active,
    stage: c.stage,
    driveFolder: c.driveFolder,
    updates: c.updates.map((u) => ({ ...u })),
    files: c.files.map((f) => ({ ...f })),
    revisions: c.revisions.map((r) => ({ ...r })),
    invoices: c.invoices.map((i) => ({ ...i })),
    staging: { ...(c.staging ?? EMPTY_STAGING) },
    feedbackOpen: c.feedbackOpen,
    feedback: c.feedback,
    widgetKey: c.widgetKey,
    lastSeenByClient: c.lastSeenByClient,
    pipeline: c.pipeline,
    draftReplies: c.draftReplies,
  };
}

export const blank = {
  update: (): ClientUpdate => ({ phase: '', status: 'upcoming', notes: '', date: '' }),
  file: (): ClientFile => ({ name: '', url: '', description: '', date: '' }),
  revision: (): ClientRevision => ({ phase: '', description: '', status: 'requested', date: '' }),
  invoice: (): ClientInvoice => ({ description: '', amount: '', status: 'pending', dueDate: '', invoiceUrl: '' }),
};

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Draft state + persistence for one client's portal content.
 * All editors mutate the draft; "Save portal" writes it via /api/clients/save.
 */
export function useClientDraft(client: Client, onSaved?: (draft: ClientData) => void) {
  const [draft, setDraft] = useState<ClientData>(() => toData(client));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  function patch(p: Partial<ClientData>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function setStaging(p: Partial<ClientStaging>) {
    setDraft((d) => ({ ...d, staging: { ...d.staging, ...p } }));
  }

  function updateRow<K extends keyof ClientData>(
    key: K,
    index: number,
    p: Partial<ClientData[K] extends Array<infer T> ? T : never>
  ) {
    setDraft((d) => {
      const arr = [...(d[key] as unknown as Record<string, unknown>[])];
      arr[index] = { ...arr[index], ...p };
      return { ...d, [key]: arr } as ClientData;
    });
  }

  function addRow<K extends keyof ClientData>(key: K, row: unknown) {
    setDraft((d) => ({ ...d, [key]: [...(d[key] as unknown[]), row] } as ClientData));
  }

  function removeRow<K extends keyof ClientData>(key: K, index: number) {
    setDraft((d) => ({ ...d, [key]: (d[key] as unknown[]).filter((_, i) => i !== index) } as ClientData));
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/clients/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: client.slug, data: draft }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        onSaved?.(draft);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      } else {
        setError(data.error ?? 'Failed to save.');
      }
    } catch {
      setError('Server error, try again.');
    } finally {
      setBusy(false);
    }
  }

  return { draft, setDraft, patch, setStaging, updateRow, addRow, removeRow, save, busy, error, setError, savedFlash };
}

export type ClientDraft = ReturnType<typeof useClientDraft>;

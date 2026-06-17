'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BUILD_STAGES } from '@/lib/stages';
import type {
  Client,
  ClientData,
  ClientUpdate,
  ClientFile,
  ClientRevision,
  ClientInvoice,
  ClientStaging,
} from '@/lib/clients';

const EMPTY_STAGING: ClientStaging = { url: '', username: '', password: '', status: 'building', notes: '' };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border-accent)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
};
const inputClass = 'w-full px-3 py-2 rounded-sm text-sm outline-none';
const labelClass =
  'block text-[10px] font-spec font-semibold tracking-widest uppercase mb-1';

const labelStyle: React.CSSProperties = { color: 'var(--text-faint)' };

function toData(c: Client): ClientData {
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
  };
}

const blank = {
  update: (): ClientUpdate => ({ phase: '', status: 'upcoming', notes: '', date: '' }),
  file: (): ClientFile => ({ name: '', url: '', description: '', date: '' }),
  revision: (): ClientRevision => ({ phase: '', description: '', status: 'requested', date: '' }),
  invoice: (): ClientInvoice => ({ description: '', amount: '', status: 'pending', dueDate: '', invoiceUrl: '' }),
};

export default function ClientManagerUI({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClientData | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', projectName: '' });
  const [password, setPassword] = useState<{ slug: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; name: string } | null>(null);
  const [deleteText, setDeleteText] = useState('');

  function selectClient(slug: string) {
    if (selected === slug) {
      setSelected(null);
      setDraft(null);
      return;
    }
    const c = clients.find((x) => x.slug === slug);
    if (!c) return;
    setSelected(slug);
    setDraft(toData(c));
    setError('');
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setPassword(null);
    try {
      const res = await fetch('/api/clients/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = (await res.json()) as { slug?: string; password?: string; error?: string };
      if (data.slug && data.password) {
        const newClient: Client = {
          slug: data.slug,
          name: addForm.name.trim(),
          email: addForm.email.trim(),
          projectName: addForm.projectName.trim(),
          active: true,
          passwordHash: 'set',
          stage: '',
          driveFolder: '',
          updates: [],
          files: [],
          revisions: [],
          invoices: [],
          staging: { ...EMPTY_STAGING },
        };
        setClients((prev) => [...prev, newClient]);
        setPassword({ slug: data.slug, value: data.password });
        setAddForm({ name: '', email: '', projectName: '' });
        setAddOpen(false);
      } else {
        setError(data.error ?? 'Failed to create client.');
      }
    } catch {
      setError('Server error — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!selected || !draft) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/clients/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selected, data: draft }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setClients((prev) =>
          prev.map((c) => (c.slug === selected ? { ...c, ...draft } : c))
        );
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      } else {
        setError(data.error ?? 'Failed to save.');
      }
    } catch {
      setError('Server error — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword(slug: string) {
    setBusy(true);
    setError('');
    setPassword(null);
    try {
      const res = await fetch('/api/clients/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json()) as { password?: string; error?: string };
      if (data.password) {
        setPassword({ slug, value: data.password });
      } else {
        setError(data.error ?? 'Failed to generate password.');
      }
    } catch {
      setError('Server error — try again.');
    } finally {
      setBusy(false);
    }
  }

  function openDelete(slug: string, name: string) {
    setDeleteTarget({ slug, name });
    setDeleteText('');
    setError('');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { slug } = deleteTarget;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/clients/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setClients((prev) => prev.filter((c) => c.slug !== slug));
        if (selected === slug) {
          setSelected(null);
          setDraft(null);
        }
        setDeleteTarget(null);
        setDeleteText('');
      } else {
        setError(data.error ?? 'Failed to delete.');
      }
    } catch {
      setError('Server error — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Generic helpers for editing array sections on the draft
  function updateRow<K extends keyof ClientData>(
    key: K,
    index: number,
    patch: Partial<(ClientData[K] extends Array<infer T> ? T : never)>
  ) {
    setDraft((d) => {
      if (!d) return d;
      const arr = [...(d[key] as unknown as Record<string, unknown>[])];
      arr[index] = { ...arr[index], ...patch };
      return { ...d, [key]: arr } as ClientData;
    });
  }
  function addRow<K extends keyof ClientData>(key: K, row: unknown) {
    setDraft((d) => (d ? ({ ...d, [key]: [...(d[key] as unknown[]), row] } as ClientData) : d));
  }
  function removeRow<K extends keyof ClientData>(key: K, index: number) {
    setDraft((d) =>
      d ? ({ ...d, [key]: (d[key] as unknown[]).filter((_, i) => i !== index) } as ClientData) : d
    );
  }

  function setStaging(patch: Partial<ClientStaging>) {
    setDraft((d) => (d ? { ...d, staging: { ...d.staging, ...patch } } : d));
  }

  async function uploadFiles(fileList: FileList | File[]) {
    if (!selected) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(fileList)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('slug', selected);
        const res = await fetch('/api/clients/upload', { method: 'POST', body: fd });
        const data = (await res.json()) as { url?: string; name?: string; error?: string };
        if (data.url) {
          addRow('files', { name: data.name ?? file.name, url: data.url, description: '', date: today() });
        } else {
          setError(data.error ?? 'Upload failed.');
        }
      }
    } catch {
      setError('Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const deleteReady = deleteTarget != null && deleteText.trim() === deleteTarget.name;

  return (
    <div className="space-y-5">
      {/* Two-step delete confirmation */}
      {deleteTarget && (
        <div
          onClick={() => !busy && setDeleteTarget(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card p-6 w-full max-w-md">
            <h2 className="font-bold mb-1" style={{ color: 'var(--text-heading)' }}>Delete {deleteTarget.name}?</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              This permanently removes their portal access and all portal content (updates, files, revisions, invoices). This cannot be undone.
            </p>
            <label className="block text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
              Type <span style={{ color: 'var(--text-heading)' }}>{deleteTarget.name}</span> to confirm
            </label>
            <input
              autoFocus
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              className="w-full px-3 py-2 rounded-sm text-sm outline-none mb-4"
              style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={busy} className="btn-outline text-sm">Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={!deleteReady || busy}
                className="text-sm px-4 py-2 rounded-sm font-semibold"
                style={{
                  background: deleteReady ? '#e40014' : 'var(--bg-raised)',
                  color: deleteReady ? '#fff' : 'var(--text-faint)',
                  cursor: deleteReady && !busy ? 'pointer' : 'not-allowed',
                  border: 'none',
                }}
              >
                {busy ? 'Deleting...' : 'Delete client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add client */}
      <div className="flex justify-end">
        <button onClick={() => { setAddOpen((v) => !v); setError(''); }} className="btn-primary text-sm">
          {addOpen ? 'Cancel' : '+ New Client'}
        </button>
      </div>

      {addOpen && (
        <form onSubmit={handleAdd} className="card p-6 space-y-4">
          <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Add a client</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Client Name *</label>
              <input className={inputClass} style={inputStyle} required value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Acme Co" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Email *</label>
              <input className={inputClass} style={inputStyle} type="email" required value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="joe@acme.com" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Project Name</label>
              <input className={inputClass} style={inputStyle} value={addForm.projectName}
                onChange={(e) => setAddForm({ ...addForm, projectName: e.target.value })} placeholder="Acme Website" />
            </div>
          </div>
          <button type="submit" disabled={busy} className="btn-primary text-sm">
            {busy ? 'Creating...' : 'Create + Generate Password'}
          </button>
        </form>
      )}

      {error && <p className="text-xs text-center" style={{ color: '#e40014' }}>{error}</p>}

      {clients.length === 0 && !addOpen && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No clients yet. Click “New Client” to add your first one.</p>
        </div>
      )}

      {clients.map((c) => (
        <div key={c.slug} className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>{c.name}</p>
                <span className="font-spec text-[10px] tracking-widest" style={{ color: c.active ? 'var(--accent-light)' : 'var(--text-faint)' }}>
                  {c.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{c.email}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={() => selectClient(c.slug)} className="btn-outline text-xs">
                {selected === c.slug ? 'Close' : 'Edit portal'}
              </button>
              <button onClick={() => handlePassword(c.slug)} disabled={busy} className="btn-primary text-xs">
                New Password
              </button>
            </div>
          </div>

          {password?.slug === c.slug && (
            <div className="mt-4 p-4 rounded-sm" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
              <p className="text-xs font-spec font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                Password — copy and send to client:
              </p>
              <div className="flex items-center gap-3">
                <code className="font-spec text-lg tracking-widest flex-1" style={{ color: 'var(--text-heading)' }}>{password.value}</code>
                <button onClick={() => copy(password.value)} className="btn-outline text-xs flex-shrink-0">{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>This password is shown once. Share it with {c.name} directly.</p>
            </div>
          )}

          {selected === c.slug && draft && (
            <div className="mt-6 pt-6 space-y-8" style={{ borderTop: '1px solid var(--border-accent)' }}>
              {/* Basics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass} style={labelStyle}>Email</label>
                  <input className={inputClass} style={inputStyle} value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Project Name</label>
                  <input className={inputClass} style={inputStyle} value={draft.projectName}
                    onChange={(e) => setDraft({ ...draft, projectName: e.target.value })} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={draft.active}
                      onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                    Active (can log in)
                  </label>
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Build Stage</label>
                  <Select
                    value={draft.stage}
                    onChange={(v) => setDraft({ ...draft, stage: v })}
                    options={[['', 'Not started'], ...BUILD_STAGES.map((s) => [s, s] as [string, string])]}
                  />
                  <p className="text-[11px] mt-1 font-spec" style={{ color: 'var(--text-faint)' }}>
                    Fills the progress bar in the client portal.
                  </p>
                </div>
              </div>

              {/* Staging Site */}
              <div>
                <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Staging Site</h3>
                <div className="p-3 rounded-sm space-y-3" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Staging URL" full>
                      <input className={inputClass} style={inputStyle} value={draft.staging.url} placeholder="https://staging.client.com"
                        onChange={(e) => setStaging({ url: e.target.value })} />
                    </Field>
                    <Field label="Username">
                      <input className={inputClass} style={inputStyle} value={draft.staging.username}
                        onChange={(e) => setStaging({ username: e.target.value })} />
                    </Field>
                    <Field label="Password / Access">
                      <input className={inputClass} style={inputStyle} value={draft.staging.password}
                        onChange={(e) => setStaging({ password: e.target.value })} />
                    </Field>
                    <Field label="Status">
                      <Select value={draft.staging.status} onChange={(v) => setStaging({ status: v as ClientStaging['status'] })}
                        options={[['building', 'Building'], ['ready', 'Ready for Review'], ['live', 'Live'], ['down', 'Down for Updates']]} />
                    </Field>
                    <Field label="Notes" full>
                      <input className={inputClass} style={inputStyle} value={draft.staging.notes} placeholder="Homepage and About are live; product pages coming Friday."
                        onChange={(e) => setStaging({ notes: e.target.value })} />
                    </Field>
                  </div>
                </div>
              </div>

              {/* Project Updates */}
              <Section title="Project Updates" onAdd={() => addRow('updates', blank.update())}>
                {draft.updates.map((u, i) => (
                  <Row key={i} onRemove={() => removeRow('updates', i)}>
                    <Field label="Phase"><input className={inputClass} style={inputStyle} value={u.phase} onChange={(e) => updateRow('updates', i, { phase: e.target.value })} /></Field>
                    <Field label="Status">
                      <Select value={u.status} onChange={(v) => updateRow('updates', i, { status: v as ClientUpdate['status'] })}
                        options={[['upcoming', 'Upcoming'], ['in-progress', 'In Progress'], ['pending-signoff', 'Pending Sign-off'], ['complete', 'Complete']]} />
                    </Field>
                    <Field label="Date"><input type="date" className={inputClass} style={inputStyle} value={u.date} onChange={(e) => updateRow('updates', i, { date: e.target.value })} /></Field>
                    <Field label="Notes" full><input className={inputClass} style={inputStyle} value={u.notes} onChange={(e) => updateRow('updates', i, { notes: e.target.value })} /></Field>
                  </Row>
                ))}
              </Section>

              {/* Client upload folder (Google Drive) */}
              <div>
                <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Client Upload Folder (Google Drive)</h3>
                <div className="p-3 rounded-sm space-y-2" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
                  <Field label="Google Drive folder link">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={draft.driveFolder}
                      placeholder="https://drive.google.com/drive/folders/..."
                      onChange={(e) => setDraft({ ...draft, driveFolder: e.target.value })}
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => copy(draft.driveFolder)}
                      disabled={!draft.driveFolder}
                      className="btn-outline text-xs"
                    >
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                    {draft.driveFolder && (
                      <a href={draft.driveFolder} target="_blank" rel="noopener noreferrer" className="font-spec text-xs" style={{ color: 'var(--accent-light)' }}>
                        Open in Drive →
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] font-spec" style={{ color: 'var(--text-faint)' }}>
                    In Google Drive, share this folder with the client&apos;s email as an <strong>Editor</strong> so they can upload. The client sees an &ldquo;Upload to shared folder&rdquo; button in their portal.
                  </p>
                </div>
              </div>

              {/* Shared Files */}
              <Section title="Shared Files" onAdd={() => addRow('files', blank.file())}>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
                  className="rounded-sm p-6 text-center transition-colors"
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--accent-light)' : 'var(--border-accent)'}`,
                    background: dragOver ? 'var(--bg-raised)' : 'var(--bg-surface)',
                  }}
                >
                  <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                    {uploading ? 'Uploading...' : 'Drag and drop files here'}
                  </p>
                  <label className="btn-outline text-xs cursor-pointer">
                    or browse
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
                    />
                  </label>
                  <p className="text-[11px] mt-2 font-spec" style={{ color: 'var(--text-faint)' }}>
                    Uploaded files are stored on the server. You can also add a Drive/Dropbox link with “+ Add”.
                  </p>
                </div>
                {draft.files.map((f, i) => (
                  <Row key={i} onRemove={() => removeRow('files', i)}>
                    <Field label="File Name"><input className={inputClass} style={inputStyle} value={f.name} onChange={(e) => updateRow('files', i, { name: e.target.value })} /></Field>
                    <Field label="URL (Drive/Dropbox)"><input className={inputClass} style={inputStyle} value={f.url} onChange={(e) => updateRow('files', i, { url: e.target.value })} /></Field>
                    <Field label="Date"><input type="date" className={inputClass} style={inputStyle} value={f.date} onChange={(e) => updateRow('files', i, { date: e.target.value })} /></Field>
                    <Field label="Description" full><input className={inputClass} style={inputStyle} value={f.description} onChange={(e) => updateRow('files', i, { description: e.target.value })} /></Field>
                  </Row>
                ))}
              </Section>

              {/* Revisions */}
              <Section title="Feedback & Revisions" onAdd={() => addRow('revisions', blank.revision())}>
                {draft.revisions.map((r, i) => (
                  <Row key={i} onRemove={() => removeRow('revisions', i)}>
                    <Field label="Phase"><input className={inputClass} style={inputStyle} value={r.phase} onChange={(e) => updateRow('revisions', i, { phase: e.target.value })} /></Field>
                    <Field label="Status">
                      <Select value={r.status} onChange={(v) => updateRow('revisions', i, { status: v as ClientRevision['status'] })}
                        options={[['requested', 'Requested'], ['in-progress', 'In Progress'], ['complete', 'Complete']]} />
                    </Field>
                    <Field label="Date"><input type="date" className={inputClass} style={inputStyle} value={r.date} onChange={(e) => updateRow('revisions', i, { date: e.target.value })} /></Field>
                    <Field label="Description" full><input className={inputClass} style={inputStyle} value={r.description} onChange={(e) => updateRow('revisions', i, { description: e.target.value })} /></Field>
                  </Row>
                ))}
              </Section>

              {/* Invoices */}
              <Section title="Invoices" onAdd={() => addRow('invoices', blank.invoice())}>
                {draft.invoices.map((inv, i) => (
                  <Row key={i} onRemove={() => removeRow('invoices', i)}>
                    <Field label="Description"><input className={inputClass} style={inputStyle} value={inv.description} onChange={(e) => updateRow('invoices', i, { description: e.target.value })} /></Field>
                    <Field label="Amount"><input className={inputClass} style={inputStyle} value={inv.amount} onChange={(e) => updateRow('invoices', i, { amount: e.target.value })} placeholder="$2,250" /></Field>
                    <Field label="Status">
                      <Select value={inv.status} onChange={(v) => updateRow('invoices', i, { status: v as ClientInvoice['status'] })}
                        options={[['pending', 'Pending'], ['paid', 'Paid'], ['overdue', 'Overdue']]} />
                    </Field>
                    <Field label="Due Date"><input type="date" className={inputClass} style={inputStyle} value={inv.dueDate} onChange={(e) => updateRow('invoices', i, { dueDate: e.target.value })} /></Field>
                    <Field label="Invoice PDF URL (optional)" full><input className={inputClass} style={inputStyle} value={inv.invoiceUrl ?? ''} onChange={(e) => updateRow('invoices', i, { invoiceUrl: e.target.value })} /></Field>
                  </Row>
                ))}
              </Section>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleSave} disabled={busy} className="btn-primary text-sm">
                  {busy ? 'Saving...' : savedFlash ? 'Saved ✓' : 'Save portal'}
                </button>
                <button onClick={() => openDelete(c.slug, c.name)} disabled={busy} className="btn-outline text-xs" style={{ color: '#e40014', borderColor: '#e40014' }}>
                  Delete client
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-accent)' }}>
        <p className="text-xs text-center font-spec" style={{ color: 'var(--text-faint)' }}>
          <Link href="/keystatic" style={{ color: 'var(--accent-light)' }}>← Articles &amp; Work CMS</Link>
          {' · '}
          <Link href="/" style={{ color: 'var(--text-faint)' }}>Main site</Link>
        </p>
      </div>
    </div>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>{title}</h3>
        <button onClick={onAdd} className="btn-outline text-xs">+ Add</button>
      </div>
      <div className="space-y-3">
        {children}
        {/* empty state handled by absence of rows */}
      </div>
    </div>
  );
}

function Row({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-sm" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
      <div className="flex justify-end mt-2">
        <button onClick={onRemove} className="text-xs font-spec" style={{ color: '#e40014' }}>Remove</button>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'sm:col-span-3' : ''}>
      <label className={labelClass} style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select className={inputClass} style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

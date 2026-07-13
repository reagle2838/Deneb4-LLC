'use client';

import { useState } from 'react';
import type { ClientUpdate, ClientRevision, ClientInvoice, ClientStaging } from '@/lib/clients';
import { formatInvoiceAmount } from '@/lib/format';
import { Field, Row, Section, Select, inputClass, inputStyle, labelClass, labelStyle } from './fields';
import { blank, today, type ClientDraft } from './useClientDraft';

/** The portal-content editors, ported from ClientManagerUI and split up. */

export function BasicsEditor({ d }: { d: ClientDraft }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass} style={labelStyle}>Email</label>
          <input className={inputClass} style={inputStyle} value={d.draft.email} onChange={(e) => d.patch({ email: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Phone</label>
          <input className={inputClass} style={inputStyle} value={d.draft.phone} placeholder="(555) 555-0100" onChange={(e) => d.patch({ phone: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} style={labelStyle}>Project Name</label>
          <input className={inputClass} style={inputStyle} value={d.draft.projectName} onChange={(e) => d.patch({ projectName: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Internal notes (never shown to the client)</label>
        <textarea
          className={inputClass}
          style={{ ...inputStyle, minHeight: '4.5rem' }}
          value={d.draft.internalNotes}
          placeholder="How they found us, context from calls, reminders..."
          onChange={(e) => d.patch({ internalNotes: e.target.value })}
        />
      </div>
    </div>
  );
}

export function StagingEditor({ d }: { d: ClientDraft }) {
  return (
    <div>
      <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Staging Site</h3>
      <div className="p-3 rounded-sm space-y-3" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Staging URL" full>
            <input className={inputClass} style={inputStyle} value={d.draft.staging.url} placeholder="https://staging.client.com"
              onChange={(e) => d.setStaging({ url: e.target.value })} />
          </Field>
          <Field label="Username">
            <input className={inputClass} style={inputStyle} value={d.draft.staging.username}
              onChange={(e) => d.setStaging({ username: e.target.value })} />
          </Field>
          <Field label="Password / Access">
            <input className={inputClass} style={inputStyle} value={d.draft.staging.password}
              onChange={(e) => d.setStaging({ password: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={d.draft.staging.status} onChange={(v) => d.setStaging({ status: v as ClientStaging['status'] })}
              options={[['building', 'Building'], ['ready', 'Ready for Review'], ['live', 'Live'], ['down', 'Down for Updates']]} />
          </Field>
          <Field label="Notes" full>
            <input className={inputClass} style={inputStyle} value={d.draft.staging.notes} placeholder="Homepage and About are live; product pages coming Friday."
              onChange={(e) => d.setStaging({ notes: e.target.value })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={d.draft.feedbackOpen} onChange={(e) => d.patch({ feedbackOpen: e.target.checked })} />
          Allow this client to send messages (portal + staging widget)
        </label>
      </div>
    </div>
  );
}

export function UpdatesEditor({ d }: { d: ClientDraft }) {
  return (
    <Section title="Project Updates" onAdd={() => d.addRow('updates', blank.update())}>
      {d.draft.updates.map((u, i) => (
        <Row key={i} onRemove={() => d.removeRow('updates', i)}>
          <Field label="Phase"><input className={inputClass} style={inputStyle} value={u.phase} onChange={(e) => d.updateRow('updates', i, { phase: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={u.status} onChange={(v) => d.updateRow('updates', i, { status: v as ClientUpdate['status'] })}
              options={[['upcoming', 'Upcoming'], ['in-progress', 'In Progress'], ['pending-signoff', 'Pending Sign-off'], ['complete', 'Complete']]} />
          </Field>
          <Field label="Date"><input type="date" className={inputClass} style={inputStyle} value={u.date} onChange={(e) => d.updateRow('updates', i, { date: e.target.value })} /></Field>
          <Field label="Notes" full><input className={inputClass} style={inputStyle} value={u.notes} onChange={(e) => d.updateRow('updates', i, { notes: e.target.value })} /></Field>
        </Row>
      ))}
      <p className="text-[11px] font-spec" style={{ color: 'var(--text-faint)' }}>
        Set a row to Pending Sign-off and the client gets a big Approve button in their portal.
      </p>
    </Section>
  );
}

export function FilesEditor({ d, slug }: { d: ClientDraft; slug: string }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);

  async function uploadFiles(fileList: FileList | File[]) {
    setUploading(true);
    d.setError('');
    try {
      for (const file of Array.from(fileList)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('slug', slug);
        const res = await fetch('/api/clients/upload', { method: 'POST', body: fd });
        const data = (await res.json()) as { url?: string; name?: string; error?: string };
        if (data.url) {
          d.addRow('files', { name: data.name ?? file.name, url: data.url, description: '', date: today() });
        } else {
          d.setError(data.error ?? 'Upload failed.');
        }
      }
    } catch {
      d.setError('Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function copyDrive() {
    await navigator.clipboard.writeText(d.draft.driveFolder);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Client Upload Folder (Google Drive)</h3>
        <div className="p-3 rounded-sm space-y-2" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
          <Field label="Google Drive folder link">
            <input
              className={inputClass}
              style={inputStyle}
              value={d.draft.driveFolder}
              placeholder="https://drive.google.com/drive/folders/..."
              onChange={(e) => d.patch({ driveFolder: e.target.value })}
            />
          </Field>
          <div className="flex items-center gap-3">
            <button type="button" onClick={copyDrive} disabled={!d.draft.driveFolder} className="btn-outline text-xs">
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            {d.draft.driveFolder && (
              <a href={d.draft.driveFolder} target="_blank" rel="noopener noreferrer" className="font-spec text-xs" style={{ color: 'var(--accent-light)' }}>
                Open in Drive →
              </a>
            )}
          </div>
          <p className="text-[11px] font-spec" style={{ color: 'var(--text-faint)' }}>
            In Google Drive, share this folder with the client&apos;s email as an <strong>Editor</strong> so they can upload. The client sees an &ldquo;Add your files&rdquo; button in their portal.
            This folder is the file exchange for the whole project: contracts and signed documents live here, and clients drop images, specs, and docs here rather than attaching them to messages.
          </p>
        </div>
      </div>

      <Section title="Shared Files" onAdd={() => d.addRow('files', blank.file())}>
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
            Uploaded files are stored on the server. You can also add a Drive/Dropbox link with &ldquo;+ Add&rdquo;.
          </p>
        </div>
        {d.draft.files.map((f, i) => (
          <Row key={i} onRemove={() => d.removeRow('files', i)}>
            <Field label="File Name"><input className={inputClass} style={inputStyle} value={f.name} onChange={(e) => d.updateRow('files', i, { name: e.target.value })} /></Field>
            <Field label="URL (Drive/Dropbox)"><input className={inputClass} style={inputStyle} value={f.url} onChange={(e) => d.updateRow('files', i, { url: e.target.value })} /></Field>
            <Field label="Date"><input type="date" className={inputClass} style={inputStyle} value={f.date} onChange={(e) => d.updateRow('files', i, { date: e.target.value })} /></Field>
            <Field label="Description" full><input className={inputClass} style={inputStyle} value={f.description} onChange={(e) => d.updateRow('files', i, { description: e.target.value })} /></Field>
          </Row>
        ))}
      </Section>
    </div>
  );
}

export function InvoicesEditor({ d }: { d: ClientDraft }) {
  return (
    <Section title="Invoices" onAdd={() => d.addRow('invoices', blank.invoice())}>
      {d.draft.invoices.map((inv, i) => (
        <Row key={i} onRemove={() => d.removeRow('invoices', i)}>
          <Field label="Description"><input className={inputClass} style={inputStyle} value={inv.description} onChange={(e) => d.updateRow('invoices', i, { description: e.target.value })} /></Field>
          <Field label={`Amount${inv.amount ? ` (shows as ${formatInvoiceAmount(inv.amount)})` : ''}`}>
            <input className={inputClass} style={inputStyle} value={inv.amount} onChange={(e) => d.updateRow('invoices', i, { amount: e.target.value })} placeholder="2250" />
          </Field>
          <Field label="Status">
            <Select value={inv.status} onChange={(v) => d.updateRow('invoices', i, { status: v as ClientInvoice['status'] })}
              options={[['pending', 'Pending'], ['paid', 'Paid'], ['overdue', 'Overdue']]} />
          </Field>
          <Field label="Due Date"><input type="date" className={inputClass} style={inputStyle} value={inv.dueDate} onChange={(e) => d.updateRow('invoices', i, { dueDate: e.target.value })} /></Field>
          <Field label="Invoice PDF URL (optional)" full><input className={inputClass} style={inputStyle} value={inv.invoiceUrl ?? ''} onChange={(e) => d.updateRow('invoices', i, { invoiceUrl: e.target.value })} /></Field>
        </Row>
      ))}
    </Section>
  );
}

export function RevisionsEditor({ d }: { d: ClientDraft }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
        {open ? '▾' : '▸'} Legacy revisions ({d.draft.revisions.length})
      </button>
      {open && (
        <div className="mt-3">
          <p className="text-[11px] mb-3 font-spec" style={{ color: 'var(--text-faint)' }}>
            Old change-request rows. They show in the client&apos;s Progress notes; new requests should come through Messages.
          </p>
          <Section title="Revisions" onAdd={() => d.addRow('revisions', blank.revision())}>
            {d.draft.revisions.map((r, i) => (
              <Row key={i} onRemove={() => d.removeRow('revisions', i)}>
                <Field label="Phase"><input className={inputClass} style={inputStyle} value={r.phase} onChange={(e) => d.updateRow('revisions', i, { phase: e.target.value })} /></Field>
                <Field label="Status">
                  <Select value={r.status} onChange={(v) => d.updateRow('revisions', i, { status: v as ClientRevision['status'] })}
                    options={[['requested', 'Requested'], ['in-progress', 'In Progress'], ['complete', 'Complete']]} />
                </Field>
                <Field label="Date"><input type="date" className={inputClass} style={inputStyle} value={r.date} onChange={(e) => d.updateRow('revisions', i, { date: e.target.value })} /></Field>
                <Field label="Description" full><input className={inputClass} style={inputStyle} value={r.description} onChange={(e) => d.updateRow('revisions', i, { description: e.target.value })} /></Field>
              </Row>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

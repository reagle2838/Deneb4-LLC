import type { ClientFile } from '@/lib/clients';
import { formatFriendlyDate } from '@/lib/format';

function FolderIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden className="flex-shrink-0">
      <path
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.8a1.5 1.5 0 0 1 1.06.44L10.6 6.5h8.9A1.5 1.5 0 0 1 21 8v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V6.5Z"
        fill="var(--accent)"
        fillOpacity="0.14"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** "Your files": always open, folder-styled, with the Drive upload button. */
export default function FilesSection({ files, driveFolder }: { files: ClientFile[]; driveFolder: string }) {
  return (
    <div id="files" className="mb-6 scroll-mt-24">
      {/* Folder tab */}
      <div
        style={{
          width: '44%',
          maxWidth: '220px',
          height: '16px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-accent)',
          borderLeft: '1px solid var(--border-accent)',
          borderRight: '1px solid var(--border-accent)',
          borderRadius: '8px 14px 0 0',
        }}
      />
      {/* Folder body */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-accent)',
          borderRadius: '0 10px 10px 10px',
          marginTop: '-1px',
          overflow: 'hidden',
        }}
      >
        <div className="px-6 py-4 flex items-center gap-3">
          <FolderIcon />
          <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Your files</h2>
          <span className="font-spec text-[11px]" style={{ color: 'var(--text-faint)' }}>
            {files.length === 1 ? '1 file' : `${files.length} files`}
          </span>
        </div>
        {driveFolder && (
          <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: '1px solid var(--border-accent)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Add your files</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Logos, photos, price lists, anything we should have. They go into our shared folder.
              </p>
            </div>
            <a href={driveFolder} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex-shrink-0">
              Add your files →
            </a>
          </div>
        )}
        {files.length === 0 ? (
          <div className="px-6 py-6 text-center" style={{ borderTop: '1px solid var(--border-accent)' }}>
            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Nothing shared with you yet. Files we share will show up here.</p>
          </div>
        ) : (
          files.map((f, i) => (
            <div key={i} className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderTop: '1px solid var(--border-accent)' }}>
              <div>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium" style={{ color: 'var(--accent-light)' }}>{f.name} →</a>
                {f.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.description}</p>}
              </div>
              {f.date && <span className="font-spec text-[10px] flex-shrink-0 mt-0.5" style={{ color: 'var(--text-faint)' }}>{formatFriendlyDate(f.date)}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

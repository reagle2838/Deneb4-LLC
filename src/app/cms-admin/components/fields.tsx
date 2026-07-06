'use client';

/** Shared form primitives for the Workspace (extracted from ClientManagerUI). */

export const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border-accent)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
};
export const inputClass = 'w-full px-3 py-2 rounded-sm text-sm outline-none';
export const labelClass =
  'block text-[10px] font-spec font-semibold tracking-widest uppercase mb-1';
export const labelStyle: React.CSSProperties = { color: 'var(--text-faint)' };

export function Section({ title, onAdd, children }: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-spec font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>{title}</h3>
        {onAdd && <button onClick={onAdd} className="btn-outline text-xs">+ Add</button>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function Row({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-sm" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
      <div className="flex justify-end mt-2">
        <button onClick={onRemove} className="text-xs font-spec" style={{ color: '#e40014' }}>Remove</button>
      </div>
    </div>
  );
}

export function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'sm:col-span-3' : ''}>
      <label className={labelClass} style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select className={inputClass} style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

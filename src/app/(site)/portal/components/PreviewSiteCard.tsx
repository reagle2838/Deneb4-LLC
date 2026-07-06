import type { ClientStaging } from '@/lib/clients';
import StatusText from './StatusText';

/** "Your website preview": the staging site, in plain words. */
export default function PreviewSiteCard({ staging }: { staging: ClientStaging }) {
  const hasAnything = staging.url || staging.username || staging.notes;
  if (!hasAnything) return null;

  const url = staging.url
    ? /^https?:\/\//i.test(staging.url) ? staging.url : `https://${staging.url}`
    : '';

  return (
    <div className="card p-6 mb-6" style={{ borderColor: 'var(--accent-light)' }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Your website preview</h2>
            <StatusText status={staging.status} />
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {staging.notes || 'This is a private, work-in-progress copy of your website. Click around as much as you like: you cannot break anything.'}
          </p>
          {(staging.username || staging.password) && (
            <div className="mt-3 p-3 rounded-sm" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-accent)' }}>
              <p className="font-spec text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-faint)' }}>
                Sign-in details for the preview
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-1">
                {staging.username && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Username: <span className="font-spec" style={{ color: 'var(--text-heading)' }}>{staging.username}</span>
                  </p>
                )}
                {staging.password && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Password: <span className="font-spec" style={{ color: 'var(--text-heading)' }}>{staging.password}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary flex-shrink-0">
            View your preview →
          </a>
        )}
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--text-faint)' }}>
        Spot something you want changed? Use the Messages section below, or the comment bubble on the preview itself.
      </p>
    </div>
  );
}

import type { ClientInvoice } from '@/lib/clients';
import { formatFriendlyDate, formatInvoiceAmount } from '@/lib/format';
import StatusText from './StatusText';

/** "Billing": invoices with consistently formatted amounts. */
export default function BillingSection({ invoices }: { invoices: ClientInvoice[] }) {
  return (
    <div id="billing" className="card p-6 mb-6 scroll-mt-24" style={{ padding: 0 }}>
      <div className="px-6 py-4 flex items-center gap-3">
        <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>Billing</h2>
        <span className="font-spec text-[11px]" style={{ color: 'var(--text-faint)' }}>
          {invoices.length === 1 ? '1 invoice' : `${invoices.length} invoices`}
        </span>
      </div>
      {invoices.length === 0 ? (
        <div className="px-6 py-6 text-center" style={{ borderTop: '1px solid var(--border-accent)' }}>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No invoices yet.</p>
        </div>
      ) : (
        invoices.map((inv, i) => (
          <div key={i} className="px-6 py-4 flex flex-wrap items-center justify-between gap-4" style={{ borderTop: '1px solid var(--border-accent)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{inv.description}</p>
              {inv.dueDate && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Due {formatFriendlyDate(inv.dueDate)}</p>}
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="font-spec font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>{formatInvoiceAmount(inv.amount)}</span>
              <StatusText status={inv.status} />
              {inv.invoiceUrl && (
                <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-spec text-[11px]" style={{ color: 'var(--accent-light)' }}>
                  View invoice →
                </a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

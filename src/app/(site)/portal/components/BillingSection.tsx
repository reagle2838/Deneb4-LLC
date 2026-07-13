import type { ClientInvoice } from '@/lib/clients';
import { formatFriendlyDate, formatInvoiceAmount } from '@/lib/format';
import StatusText from './StatusText';

/**
 * "Billing": invoices with consistently formatted amounts, expandable line
 * items where the itemization is on file, and how-to-pay instructions.
 */
export default function BillingSection({
  invoices,
  invoiceLines = {},
  paymentInstructions = '',
}: {
  invoices: ClientInvoice[];
  invoiceLines?: Record<string, { label: string; amount: string }[]>;
  paymentInstructions?: string;
}) {
  const hasUnpaid = invoices.some((inv) => inv.status !== 'paid');
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
        invoices.map((inv, i) => {
          const lines = invoiceLines[inv.description];
          return (
            <div key={i} className="px-6 py-4" style={{ borderTop: '1px solid var(--border-accent)' }}>
              <div className="flex flex-wrap items-center justify-between gap-4">
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
              {lines && lines.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer font-spec" style={{ color: 'var(--accent-light)' }}>What&apos;s included</summary>
                  <div className="mt-1.5 space-y-1">
                    {lines.map((l, j) => (
                      <div key={j} className="flex items-baseline justify-between gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>{l.label}</span>
                        <span className="font-spec whitespace-nowrap">{l.amount}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })
      )}
      {invoices.length > 0 && (
        <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border-accent)', background: 'var(--bg-alt)' }}>
          <p className="font-spec text-[11px] tracking-widest uppercase mb-1" style={{ color: 'var(--text-faint)' }}>How to pay</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {paymentInstructions ||
              (hasUnpaid
                ? 'Payment details come with your invoice email — reply there and we’ll sort it out together.'
                : 'All settled — thank you!')}
          </p>
        </div>
      )}
    </div>
  );
}

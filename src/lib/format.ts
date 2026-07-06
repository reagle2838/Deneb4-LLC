/** Display formatting helpers shared by the portal and workspace. */

/**
 * Format a raw invoice amount string for display.
 * "1250" -> "$1,250", "2250.50" -> "$2,250.50", "$2,250" -> "$2,250".
 * Anything non-numeric passes through untouched.
 */
export function formatInvoiceAmount(raw: string): string {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return raw;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return raw;
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
}

/** Format an ISO date ("2026-06-12" or a full timestamp) as "June 12, 2026". */
export function formatFriendlyDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Short date for tight layouts: "Jun 12". Falls back to the raw string. */
export function formatShortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

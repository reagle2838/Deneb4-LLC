import type { Client, ClientFeedback } from './clients';
import { sendEmail } from './email';

/**
 * Notification emails between the studio and clients.
 *
 * Every function here catches its own errors and never throws: an email
 * outage must never fail the API request that triggered it. Failures are
 * logged with a [deneb4] prefix for the server console.
 */

const SITE_URL = process.env.SITE_URL || 'https://deneb4.com';
const OWNER_EMAIL = process.env.CONTACT_TO_EMAIL || 'hello@deneb4.com';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Minimal branded template: mono eyebrow, heading, body lines, one button. */
function template(opts: {
  eyebrow: string;
  heading: string;
  lines: string[];
  quote?: string;
  cta: { label: string; href: string };
}): string {
  const quoteBlock = opts.quote
    ? `<div style="margin:16px 0;padding:12px 16px;border-left:3px solid #006b8f;background:#f2f5f9;border-radius:2px;color:#18222e;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(opts.quote)}</div>`
    : '';
  const lines = opts.lines
    .map((l) => `<p style="margin:8px 0;color:#4e606f;font-size:14px;line-height:1.6;">${l}</p>`)
    .join('');
  return `
  <div style="background:#f2f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,107,143,0.18);border-top:3px solid #006b8f;border-radius:4px;padding:28px 28px 24px;">
      <p style="margin:0 0 14px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#1f93ba;">${escapeHtml(opts.eyebrow)}</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.35;color:#080f1a;">${escapeHtml(opts.heading)}</h1>
      ${lines}
      ${quoteBlock}
      <a href="${opts.cta.href}" style="display:inline-block;margin-top:16px;background:#006b8f;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:10px 22px;border-radius:2px;">${escapeHtml(opts.cta.label)}</a>
      <p style="margin:24px 0 0;font-size:11px;color:#7d8d9b;">Deneb4 · Industrial &amp; Technical Web Design</p>
    </div>
  </div>`;
}

/** A client wrote a new message (from the portal or the staging-site widget). */
export async function notifyOwnerOfClientMessage(
  client: Client,
  entry: ClientFeedback,
  source: 'portal' | 'widget'
): Promise<void> {
  try {
    const where = source === 'widget' ? 'from the staging site' : 'from the portal';
    await sendEmail({
      to: OWNER_EMAIL,
      subject: `New message from ${client.name}`,
      replyTo: client.email || undefined,
      html: template({
        eyebrow: 'Client message',
        heading: `${client.name} sent a message ${where}.`,
        lines: [
          entry.page ? `Regarding: ${escapeHtml(entry.page)}` : '',
          client.projectName ? `Project: ${escapeHtml(client.projectName)}` : '',
        ].filter(Boolean),
        quote: entry.message,
        cta: { label: 'Open in Workspace', href: `${SITE_URL}/cms-admin?client=${client.slug}` },
      }),
    });
  } catch (err) {
    console.error('[deneb4] notify owner of client message failed:', err);
  }
}

/** The studio replied: let the client know there is something to read. */
export async function notifyClientOfReply(client: Client, entry: ClientFeedback): Promise<void> {
  if (!client.email) return;
  try {
    await sendEmail({
      to: client.email,
      subject: `New update on ${client.projectName || 'your project'}`,
      html: template({
        eyebrow: 'Project update',
        heading: `You have a new message from Deneb4.`,
        lines: ['Sign in to your project portal to read and reply.'],
        quote: entry.message.length > 240 ? `${entry.message.slice(0, 240)}...` : entry.message,
        cta: { label: 'Open your portal', href: `${SITE_URL}/portal` },
      }),
    });
  } catch (err) {
    console.error('[deneb4] notify client of reply failed:', err);
  }
}

/** A client approved a phase from their portal. */
export async function notifyOwnerOfApproval(client: Client, phase: string): Promise<void> {
  try {
    await sendEmail({
      to: OWNER_EMAIL,
      subject: `${client.name} approved: ${phase}`,
      replyTo: client.email || undefined,
      html: template({
        eyebrow: 'Phase approved',
        heading: `${client.name} approved "${phase}".`,
        lines: [
          client.projectName ? `Project: ${escapeHtml(client.projectName)}` : '',
          `Approved on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
        ].filter(Boolean),
        cta: { label: 'Open in Workspace', href: `${SITE_URL}/cms-admin?client=${client.slug}` },
      }),
    });
  } catch (err) {
    console.error('[deneb4] notify owner of approval failed:', err);
  }
}

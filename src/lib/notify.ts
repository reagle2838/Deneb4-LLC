import type { Client, ClientFeedback } from './clients';
import { sendEmail } from './email';
import { recordCost } from './costs';
import { loadPricing } from './pricing';

/**
 * Notification emails between the studio and clients.
 *
 * Every function here catches its own errors and never throws: an email
 * outage must never fail the API request that triggered it. Failures are
 * logged with a [deneb4] prefix for the server console.
 */

const SITE_URL = process.env.SITE_URL || 'https://deneb4.com';
const OWNER_EMAIL = process.env.CONTACT_TO_EMAIL || 'hello@deneb4.com';

/**
 * Bookkeeping for one project email: the real cost of the send (delivered
 * only — console-fallback sends cost nothing) AND a content record of what
 * was actually said (always, delivered or not), so "what exactly was the
 * client told?" is answerable later from the email log / timeline.
 */
function recordEmailCost(
  slug: string,
  delivered: boolean,
  label: string,
  content?: { direction: 'to-client' | 'to-owner'; subject: string; textParts: string[] }
): void {
  if (content) {
    try {
      // Lazy import keeps notify.ts safe to load in edge-ish contexts.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logEmail } = require('./email-log') as typeof import('./email-log');
      logEmail(slug, { ...content, delivered });
    } catch (err) {
      console.error('[deneb4] email log failed:', err);
    }
  }
  if (!delivered) return;
  const rate = loadPricing().resendCostPerEmail;
  if (rate > 0) recordCost(slug, { kind: 'resend', amount: rate, note: label });
}

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
    const result = await sendEmail({
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
    recordEmailCost(client.slug, result.delivered, 'Owner notified of client message', {
      direction: 'to-owner',
      subject: `New message from ${client.name}`,
      textParts: [entry.page ? `Regarding: ${entry.page}` : '', `Client wrote: ${entry.message}`],
    });
  } catch (err) {
    console.error('[deneb4] notify owner of client message failed:', err);
  }
}

/** The studio replied: let the client know there is something to read. */
export async function notifyClientOfReply(client: Client, entry: ClientFeedback): Promise<void> {
  if (!client.email) return;
  try {
    const result = await sendEmail({
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
    recordEmailCost(client.slug, result.delivered, 'Client notified of reply', {
      direction: 'to-client',
      subject: `New update on ${client.projectName || 'your project'}`,
      textParts: ['You have a new message from Deneb4. Sign in to your project portal to read and reply.', `Message: ${entry.message}`],
    });
  } catch (err) {
    console.error('[deneb4] notify client of reply failed:', err);
  }
}

/**
 * Welcome / new-credentials email: sends the client their portal login.
 * Returns whether it was actually delivered (false = no RESEND_API_KEY,
 * payload logged to console) so the UI can tell Ridhi to share manually.
 */
export async function notifyClientCredentials(
  client: Client,
  password: string,
  variant: 'welcome' | 'reset'
): Promise<boolean> {
  if (!client.email) return false;
  try {
    const result = await sendEmail({
      to: client.email,
      subject:
        variant === 'welcome'
          ? client.projectName
            ? `Your project portal is ready: ${client.projectName}`
            : 'Your Deneb4 project portal is ready'
          : 'Your new portal password',
      html: template({
        eyebrow: variant === 'welcome' ? 'Welcome' : 'Password reset',
        heading:
          variant === 'welcome'
            ? `Hello ${client.name.split(' ')[0]}, your project portal is ready.`
            : 'Here is your new portal password.',
        lines: [
          variant === 'welcome'
            ? 'This is where you will see progress, preview your website, send us messages, and approve each phase.'
            : 'Your old password no longer works.',
          `Sign in with: <strong>${escapeHtml(client.email)}</strong>`,
          `Password: <strong style="font-family:'Courier New',monospace;">${escapeHtml(password)}</strong>`,
        ],
        cta: { label: 'Open your portal', href: `${SITE_URL}/login` },
      }),
    });
    // Content record deliberately excludes the password — the log is a
    // communications record, never a credential store.
    recordEmailCost(client.slug, result.delivered, `Client credentials (${variant})`, {
      direction: 'to-client',
      subject: variant === 'welcome' ? 'Your project portal is ready' : 'Your new portal password',
      textParts: [`Portal ${variant} email with sign-in instructions (password omitted from this log).`],
    });
    return result.delivered;
  } catch (err) {
    console.error('[deneb4] credentials email failed:', err);
    return false;
  }
}

/** An agent posted a kind:'alert' ledger entry: escalate to Ridhi's inbox. */
export async function notifyOwnerOfAgentAlert(
  channel: string,
  agent: string,
  message: string
): Promise<void> {
  try {
    await sendEmail({
      to: OWNER_EMAIL,
      subject: `Agent alert (${agent}): ${channel}`,
      html: template({
        eyebrow: 'Agent alert',
        heading: `${agent} raised an alert on ${channel}.`,
        lines: ['The agent stopped and is waiting on you.'],
        quote: message,
        cta: {
          label: 'Open the Agents tab',
          href: `${SITE_URL}/cms-admin?tab=agents`,
        },
      }),
    });
  } catch (err) {
    console.error('[deneb4] agent alert email failed:', err);
  }
}

/**
 * Ask the client for final sign-off (fixed wording; sent when Ridhi moves
 * the project to the approval stage). Returns whether an email went out.
 */
export async function notifyClientOfSignoffRequest(client: Client): Promise<boolean> {
  if (!client.email) return false;
  try {
    const result = await sendEmail({
      to: client.email,
      replyTo: OWNER_EMAIL,
      subject: `${client.projectName || 'Your site'} is ready for your final approval`,
      html: template({
        eyebrow: 'Final approval',
        heading: `${client.projectName || 'Your site'} is ready for your review.`,
        lines: [
          `Hi ${escapeHtml(client.name)},`,
          'The finished site is up on your staging link for a last look. When everything is the way you want it, open your portal and click Approve on the "Final approval" item.',
          'If anything still needs a tweak, just tell us in Messages — nothing moves forward until you say so.',
        ],
        cta: { label: 'Review & approve', href: `${SITE_URL}/portal` },
      }),
    });
    recordEmailCost(client.slug, result.delivered, 'Sign-off request', {
      direction: 'to-client',
      subject: `${client.projectName || 'Your site'} is ready for your final approval`,
      textParts: [
        'The finished site is up on your staging link for a last look. When everything is the way you want it, open your portal and click Approve on the "Final approval" item.',
        'If anything still needs a tweak, just tell us in Messages — nothing moves forward until you say so.',
      ],
    });
    return result.delivered;
  } catch (err) {
    console.error('[deneb4] sign-off request email failed:', err);
    return false;
  }
}

/** Send the client an itemized invoice (only after Ridhi approves the send). */
export async function notifyClientOfInvoice(
  client: Client,
  invoice: { description: string; amount: string; dueDate: string },
  lines: { label: string; amount: string }[],
  waveViewUrl?: string
): Promise<boolean> {
  if (!client.email) return false;
  const rows = lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0;color:#4e606f;font-size:14px;">${escapeHtml(l.label)}</td><td style="padding:6px 0;color:#18222e;font-size:14px;text-align:right;white-space:nowrap;">${escapeHtml(l.amount)}</td></tr>`
    )
    .join('');
  try {
    const result = await sendEmail({
      to: client.email,
      replyTo: OWNER_EMAIL,
      subject: `Invoice: ${invoice.description} — ${invoice.amount}`,
      html: template({
        eyebrow: 'Invoice',
        heading: `${invoice.description}: ${invoice.amount}`,
        lines: [
          `Hi ${escapeHtml(client.name)},`,
          `<table style="width:100%;border-collapse:collapse;margin:6px 0;">${rows}<tr><td style="padding:8px 0;border-top:1px solid rgba(0,107,143,0.25);color:#080f1a;font-weight:bold;font-size:14px;">Amount due</td><td style="padding:8px 0;border-top:1px solid rgba(0,107,143,0.25);color:#080f1a;font-weight:bold;font-size:14px;text-align:right;">${escapeHtml(invoice.amount)}</td></tr></table>`,
          // Wave link wins (it's the real invoice, with online payment when
          // enabled); otherwise only promise portal payment details when
          // they're actually configured.
          waveViewUrl
            ? `Due ${escapeHtml(invoice.dueDate)}. View and pay your invoice with the button below — reply here with any questions.`
            : loadPricing().paymentInstructions
              ? `Due ${escapeHtml(invoice.dueDate)}. Payment details are in your portal's Billing section — reply here with any questions.`
              : `Due ${escapeHtml(invoice.dueDate)}. Reply to this email and we'll arrange payment together.`,
        ],
        cta: waveViewUrl
          ? { label: 'View & pay invoice', href: waveViewUrl }
          : { label: 'View in your portal', href: `${SITE_URL}/portal` },
      }),
    });
    recordEmailCost(client.slug, result.delivered, `Invoice: ${invoice.description}`, {
      direction: 'to-client',
      subject: `Invoice: ${invoice.description} — ${invoice.amount}`,
      textParts: [
        ...lines.map((l) => `${l.label}: ${l.amount}`),
        `Amount due: ${invoice.amount}, due ${invoice.dueDate}.${waveViewUrl ? ` Invoice link: ${waveViewUrl}` : ''}`,
      ],
    });
    return result.delivered;
  } catch (err) {
    console.error('[deneb4] invoice email failed:', err);
    return false;
  }
}

/** A client approved a phase from their portal. */
export async function notifyOwnerOfApproval(client: Client, phase: string): Promise<void> {
  try {
    const result = await sendEmail({
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
    recordEmailCost(client.slug, result.delivered, `Owner notified: approved ${phase}`, {
      direction: 'to-owner',
      subject: `${client.name} approved: ${phase}`,
      textParts: [`${client.name} approved "${phase}" from their portal.`],
    });
  } catch (err) {
    console.error('[deneb4] notify owner of approval failed:', err);
  }
}

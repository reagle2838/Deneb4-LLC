import { Resend } from "resend";

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Send an email via Resend.
 *
 * If RESEND_API_KEY is not set, the payload is logged to the server console
 * and the call returns successfully (delivered: false), so email-dependent
 * flows work in development before email is wired up. Add a key + verified
 * domain sender in CONTACT_FROM_EMAIL to actually send.
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL || "Deneb4 Website <onboarding@resend.dev>";

  if (!apiKey) {
    console.log("[deneb4] RESEND_API_KEY not set: logging email instead of sending:");
    console.log(JSON.stringify({ to, from, subject, replyTo, html }, null, 2));
    return { ok: true, delivered: false };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    replyTo,
  });

  if (error) {
    throw new Error(error.message || "Email delivery failed");
  }
  return { ok: true, delivered: true };
}

interface SendFormArgs {
  subject: string;
  html: string;
  replyTo?: string;
}

/** Send a public form submission to the studio inbox. */
export async function sendFormEmail({ subject, html, replyTo }: SendFormArgs) {
  const to = process.env.CONTACT_TO_EMAIL || "hello@deneb4.com";
  return sendEmail({ to, subject, html, replyTo });
}

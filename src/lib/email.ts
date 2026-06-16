import { Resend } from "resend";

interface SendArgs {
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Send a form submission as email via Resend.
 *
 * If RESEND_API_KEY is not set, the payload is logged to the server console
 * and the call returns successfully (delivered: false) — so forms work in
 * development before email is wired up. Add a key + verified domain to send.
 */
export async function sendFormEmail({ subject, html, replyTo }: SendArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL || "hello@deneb4.com";
  const from = process.env.CONTACT_FROM_EMAIL || "Deneb4 Website <onboarding@resend.dev>";

  if (!apiKey) {
    console.log("[deneb4] RESEND_API_KEY not set — logging submission instead of sending email:");
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

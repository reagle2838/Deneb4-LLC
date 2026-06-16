import { NextResponse } from "next/server";
import { sendFormEmail } from "@/lib/email";

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  try {
    const data = await req.json().catch(() => null);
    if (!data) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

    const { name, email, company, topic, message } = data as Record<string, string>;
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ ok: false, error: "Name, email, and message are required." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
    }

    const html = `
      <h2>New inquiry — deneb4.com</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Company:</strong> ${esc(company) || "—"}</p>
      <p><strong>About:</strong> ${esc(topic) || "—"}</p>
      <p><strong>Message:</strong></p>
      <p>${esc(message).replace(/\n/g, "<br>")}</p>
    `;

    const result = await sendFormEmail({ subject: `New inquiry from ${name}`, html, replyTo: email });
    return NextResponse.json({ ok: true, delivered: result.delivered });
  } catch (err) {
    console.error("[deneb4] /api/contact error:", err);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please email hello@deneb4.com." }, { status: 500 });
  }
}

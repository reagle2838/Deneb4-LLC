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

    const {
      name, email, business, industry, currentSite,
      packageInterest, tools, budget, timeline, details,
    } = data as Record<string, string | string[]>;

    if (!String(name ?? "").trim() || !String(email ?? "").trim() || !String(details ?? "").trim()) {
      return NextResponse.json({ ok: false, error: "Name, email, and project details are required." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
      return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
    }

    const toolList = Array.isArray(tools) ? tools.join(", ") : esc(tools);
    const html = `
      <h2>New project brief — deneb4.com</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Business:</strong> ${esc(business) || "—"}</p>
      <p><strong>Industry:</strong> ${esc(industry) || "—"}</p>
      <p><strong>Current site:</strong> ${esc(currentSite) || "—"}</p>
      <p><strong>Package interest:</strong> ${esc(packageInterest) || "—"}</p>
      <p><strong>Tools wanted:</strong> ${toolList || "—"}</p>
      <p><strong>Budget:</strong> ${esc(budget) || "—"}</p>
      <p><strong>Timeline:</strong> ${esc(timeline) || "—"}</p>
      <p><strong>Details:</strong></p>
      <p>${esc(details).replace(/\n/g, "<br>")}</p>
    `;

    const result = await sendFormEmail({ subject: `New project brief from ${esc(name)}`, html, replyTo: String(email) });
    return NextResponse.json({ ok: true, delivered: result.delivered });
  } catch (err) {
    console.error("[deneb4] /api/project error:", err);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please email hello@deneb4.com." }, { status: 500 });
  }
}

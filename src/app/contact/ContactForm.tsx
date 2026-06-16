"use client";

import { useState } from "react";
import Link from "next/link";

const inputCls =
  "w-full px-3 py-2.5 rounded-sm text-sm outline-none transition-colors bg-theme-surface focus:[border-color:var(--accent)]";
const inputStyle = { border: "1px solid var(--border-accent)", color: "var(--text-primary)" } as React.CSSProperties;
const labelCls = "block text-xs font-spec font-semibold tracking-widest uppercase mb-2";
const labelStyle = { color: "var(--text-muted)" } as React.CSSProperties;

type Status = "idle" | "submitting" | "success" | "error";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", company: "", topic: "General question", message: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Submission failed.");
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="accent-banner card p-8">
        <h2 className="text-xl font-bold mb-2">Thanks — message received.</h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          I read every message personally and reply with a clear next step, usually within a day or two. No automated sequences.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-8 flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className={labelCls} style={labelStyle}>Name *</label>
          <input id="name" className={inputCls} style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div>
          <label htmlFor="company" className={labelCls} style={labelStyle}>Company</label>
          <input id="company" className={inputCls} style={inputStyle} value={form.company} onChange={(e) => set("company", e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="email" className={labelCls} style={labelStyle}>Email *</label>
        <input id="email" type="email" className={inputCls} style={inputStyle} value={form.email} onChange={(e) => set("email", e.target.value)} required />
      </div>
      <div>
        <label htmlFor="topic" className={labelCls} style={labelStyle}>What&apos;s this about?</label>
        <select id="topic" className={inputCls} style={inputStyle} value={form.topic} onChange={(e) => set("topic", e.target.value)}>
          {["General question", "A new project", "A redesign", "A functional tool", "Something else"].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="message" className={labelCls} style={labelStyle}>Message *</label>
        <textarea id="message" rows={5} className={inputCls} style={inputStyle} value={form.message} onChange={(e) => set("message", e.target.value)} required />
      </div>

      {status === "error" && <p className="text-sm" style={{ color: "#e40014" }}>{error}</p>}

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Send message"}
        </button>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          To start a project, use the <Link href="/start" style={{ color: "var(--accent-light)" }}>project brief</Link> instead.
        </p>
      </div>
    </form>
  );
}

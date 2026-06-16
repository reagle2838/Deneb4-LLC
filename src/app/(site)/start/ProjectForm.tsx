"use client";

import { useState } from "react";
import { INDUSTRIES } from "@/data/industries";
import { PACKAGES, FUNCTIONAL_TOOLS } from "@/data/services";

const inputCls =
  "w-full px-3 py-2.5 rounded-sm text-sm outline-none transition-colors bg-theme-surface focus:[border-color:var(--accent)]";
const inputStyle = { border: "1px solid var(--border-accent)", color: "var(--text-primary)" } as React.CSSProperties;
const labelCls = "block text-xs font-spec font-semibold tracking-widest uppercase mb-2";
const labelStyle = { color: "var(--text-muted)" } as React.CSSProperties;

type Status = "idle" | "submitting" | "success" | "error";

const BUDGETS = ["Under $5k", "$5k–$8k", "$8k+", "Not sure yet"];
const TIMELINES = ["ASAP", "1–2 months", "3+ months", "Just exploring"];

export default function ProjectForm() {
  const [form, setForm] = useState({
    name: "", email: "", business: "", industry: "", currentSite: "",
    packageInterest: "Not sure yet", budget: "", timeline: "", details: "",
  });
  const [tools, setTools] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggleTool(label: string) {
    setTools((t) => (t.includes(label) ? t.filter((x) => x !== label) : [...t, label]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tools }),
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
        <h2 className="text-xl font-bold mb-2">Brief received, thank you.</h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          I&apos;ll review the details and come back with a useful, scoped proposal, usually within a day or two. Watch your inbox for a reply from hello@deneb4.com.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-8 flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="p-name" className={labelCls} style={labelStyle}>Name *</label>
          <input id="p-name" className={inputCls} style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div>
          <label htmlFor="p-email" className={labelCls} style={labelStyle}>Email *</label>
          <input id="p-email" type="email" className={inputCls} style={inputStyle} value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </div>
        <div>
          <label htmlFor="p-business" className={labelCls} style={labelStyle}>Business name</label>
          <input id="p-business" className={inputCls} style={inputStyle} value={form.business} onChange={(e) => set("business", e.target.value)} />
        </div>
        <div>
          <label htmlFor="p-industry" className={labelCls} style={labelStyle}>Industry</label>
          <select id="p-industry" className={inputCls} style={inputStyle} value={form.industry} onChange={(e) => set("industry", e.target.value)}>
            <option value="">Select…</option>
            {INDUSTRIES.map((i) => <option key={i.slug} value={i.label}>{i.label}</option>)}
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="p-site" className={labelCls} style={labelStyle}>Current website (if any)</label>
          <input id="p-site" className={inputCls} style={inputStyle} placeholder="https://" value={form.currentSite} onChange={(e) => set("currentSite", e.target.value)} />
        </div>
        <div>
          <label htmlFor="p-package" className={labelCls} style={labelStyle}>Package interest</label>
          <select id="p-package" className={inputCls} style={inputStyle} value={form.packageInterest} onChange={(e) => set("packageInterest", e.target.value)}>
            {PACKAGES.map((p) => <option key={p.id} value={`${p.name} (${p.price})`}>{p.name}: {p.price}</option>)}
            <option value="Not sure yet">Not sure yet</option>
          </select>
        </div>
      </div>

      <div>
        <span className={labelCls} style={labelStyle}>Functional tools you&apos;re considering</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FUNCTIONAL_TOOLS.map((t) => {
            const checked = tools.includes(t.label);
            return (
              <button
                type="button"
                key={t.label}
                onClick={() => toggleTool(t.label)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-sm text-left transition-colors"
                style={{
                  border: `1px solid ${checked ? "var(--accent)" : "var(--border-accent)"}`,
                  background: checked ? "rgba(0,107,143,0.08)" : "var(--bg-surface)",
                  color: "var(--text-primary)",
                }}
                aria-pressed={checked}
              >
                <span className="w-4 h-4 rounded-sm flex items-center justify-center flex-shrink-0" style={{ border: `1px solid ${checked ? "var(--accent)" : "var(--border-accent)"}`, background: checked ? "var(--accent)" : "transparent" }}>
                  {checked && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  )}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="p-budget" className={labelCls} style={labelStyle}>Budget</label>
          <select id="p-budget" className={inputCls} style={inputStyle} value={form.budget} onChange={(e) => set("budget", e.target.value)}>
            <option value="">Select…</option>
            {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="p-timeline" className={labelCls} style={labelStyle}>Timeline</label>
          <select id="p-timeline" className={inputCls} style={inputStyle} value={form.timeline} onChange={(e) => set("timeline", e.target.value)}>
            <option value="">Select…</option>
            {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="p-details" className={labelCls} style={labelStyle}>Tell me about the project *</label>
        <textarea id="p-details" rows={5} className={inputCls} style={inputStyle} placeholder="What do you make, who do you sell to, and what should the site do?" value={form.details} onChange={(e) => set("details", e.target.value)} required />
      </div>

      {status === "error" && <p className="text-sm" style={{ color: "#e40014" }}>{error}</p>}

      <button type="submit" className="btn-primary self-start" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send project brief"}
      </button>
    </form>
  );
}

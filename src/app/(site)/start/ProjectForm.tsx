"use client";

import { useState } from "react";
import { INDUSTRIES } from "@/data/industries";
import type { CapabilityGroup } from "@/data/services";

const inputCls =
  "w-full px-3 py-2.5 rounded-sm text-sm outline-none transition-colors bg-theme-surface focus:[border-color:var(--accent)]";
const inputStyle = { border: "1px solid var(--border-accent)", color: "var(--text-primary)" } as React.CSSProperties;
const labelCls = "block text-xs font-spec font-semibold tracking-widest uppercase mb-2";
const labelStyle = { color: "var(--text-muted)" } as React.CSSProperties;

type Status = "idle" | "submitting" | "success" | "error";

const BUDGETS = ["Under $5k", "$5k-$8k", "$8k+", "Not sure yet"];
const TIMELINES = ["ASAP", "1-2 months", "3+ months", "Just exploring"];

// Google Calendar appointment scheduling link. Offered upfront in the
// Start page left rail and again on the brief success screen.
export const DISCOVERY_CALL_URL = "https://calendar.app.google/EyR1Mjzi6iGJK3gA6";

export default function ProjectForm({ groups }: { groups: CapabilityGroup[] }) {
  const [form, setForm] = useState({
    name: "", email: "", business: "", industry: "", currentSite: "",
    budget: "", timeline: "", details: "",
  });
  const [areas, setAreas] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggleArea(id: string) {
    setAreas((a) => {
      if (a.includes(id)) {
        const groupItems = groups.find((g) => g.id === id)?.items ?? [];
        setTools((t) => t.filter((x) => !groupItems.includes(x)));
        return a.filter((x) => x !== id);
      }
      return [...a, id];
    });
  }
  function toggleTool(label: string) {
    setTools((t) => (t.includes(label) ? t.filter((x) => x !== label) : [...t, label]));
  }

  const selectedGroups = groups.filter((g) => areas.includes(g.id));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    const packageInterest = selectedGroups.length
      ? selectedGroups.map((g) => g.title).join(", ")
      : "Not sure yet";
    try {
      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, packageInterest, tools }),
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
        <div className="section-divider my-6" />
        <p className="font-spec text-[11px] tracking-widest uppercase mb-2" style={{ color: "var(--text-faint)" }}>
          Prefer to talk it through?
        </p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
          If you&apos;d rather walk through your project on a quick call, grab a time that works for you. Completely optional, and there&apos;s no pressure either way.
        </p>
        <a href={DISCOVERY_CALL_URL} target="_blank" rel="noopener noreferrer" className="btn-outline">
          Book a discovery call →
        </a>
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
      </div>

      {/* Area selection */}
      <div>
        <span className={labelCls} style={labelStyle}>What are you interested in?</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {groups.map((g) => {
            const on = areas.includes(g.id);
            return (
              <button
                type="button"
                key={g.id}
                onClick={() => toggleArea(g.id)}
                aria-pressed={on}
                className="text-left p-4 rounded-sm transition-colors"
                style={{
                  border: `1px solid ${on ? "var(--accent)" : "var(--border-accent)"}`,
                  background: on ? "rgba(0,107,143,0.08)" : "var(--bg-surface)",
                }}
              >
                <span className="text-sm font-semibold block" style={{ color: "var(--text-heading)" }}>{g.title}</span>
                <span className="text-xs font-semibold mt-1 block leading-snug" style={{ color: "var(--accent)" }}>{g.tagline}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Considering — only the items for the chosen areas */}
      {selectedGroups.length > 0 && (
        <div className="flex flex-col gap-5">
          {selectedGroups.map((g) => (
            <div key={g.id}>
              <span className={labelCls} style={labelStyle}>{g.title}</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {g.items.map((label) => {
                  const checked = tools.includes(label);
                  return (
                    <button
                      type="button"
                      key={label}
                      onClick={() => toggleTool(label)}
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
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

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

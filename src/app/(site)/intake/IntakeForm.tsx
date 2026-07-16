"use client";

import { useState } from "react";

const inputCls =
  "w-full px-3 py-2.5 rounded-sm text-sm outline-none transition-colors bg-theme-surface focus:[border-color:var(--accent)]";
const inputStyle = { border: "1px solid var(--border-accent)", color: "var(--text-primary)" } as React.CSSProperties;
const labelCls = "block text-xs font-spec font-semibold tracking-widest uppercase mb-2";
const labelStyle = { color: "var(--text-muted)" } as React.CSSProperties;
const hintStyle = { color: "var(--text-faint)" } as React.CSSProperties;

type Status = "idle" | "submitting" | "success" | "error";

const PAIRING_OPTIONS = [
  "Playful & energetic",
  "Calm & soothing",
  "Quiet, elegant, upscale",
  "Editorial / magazine-like",
  "Industrial & technical",
  "Bold & authoritative",
  "Warm & handmade",
  "Modern, clean, tech-forward",
];

const MODULES: { code: string; label: string; help: string }[] = [
  { code: "catalog", label: "Product / service catalog", help: "Categories, specs, photos — customers browse what you offer." },
  { code: "careers", label: "Careers page", help: "Post openings; candidates apply from the site." },
  { code: "blog", label: "Blog / news section", help: "Write updates yourself, no developer needed." },
  { code: "gallery", label: "Photo gallery", help: "Upload and reorder photos in your own dashboard." },
];

const SOCIAL_PLATFORMS = ["LinkedIn", "Facebook", "Instagram", "X", "YouTube"];

interface FormState {
  siteName: string; tagline: string; description: string;
  contactEmail: string; contactPhone: string; address: string; brandUrl: string;
  yourName: string; yourEmail: string; yourPhone: string; billingEmail: string;
  visualDirection: string; siteWords: string; likedSites: string;
  siteGoal: string; primaryAction: string; standardPages: string; quoteTopics: string; announcement: string;
  catalogSize: string; catalogCategories: string; catalogWhereNow: string;
  blogCategories: string; galleryFocus: string;
  customFuncYes: boolean; customFuncDesc: string;
  contentReady: string; contentApprover: string;
  story: string; different: string; prospectKnow: string; trustSignals: string; faq: string; logos: string;
  launchEvent: string; schedulingNotes: string;
  discoveryCall: boolean;
  githubWanted: boolean; githubUser: string;
  anythingElse: string; howHeard: string;
}

const EMPTY: FormState = {
  siteName: "", tagline: "", description: "",
  contactEmail: "", contactPhone: "", address: "", brandUrl: "",
  yourName: "", yourEmail: "", yourPhone: "", billingEmail: "",
  visualDirection: "", siteWords: "", likedSites: "",
  siteGoal: "", primaryAction: "", standardPages: "", quoteTopics: "", announcement: "",
  catalogSize: "", catalogCategories: "", catalogWhereNow: "",
  blogCategories: "", galleryFocus: "",
  customFuncYes: false, customFuncDesc: "",
  contentReady: "", contentApprover: "",
  story: "", different: "", prospectKnow: "", trustSignals: "", faq: "", logos: "",
  launchEvent: "", schedulingNotes: "",
  discoveryCall: false,
  githubWanted: false, githubUser: "",
  anythingElse: "", howHeard: "",
};

export default function IntakeForm() {
  const [f, setF] = useState<FormState>(EMPTY);
  const [modules, setModules] = useState<string[]>([]);
  const [social, setSocial] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }
  function toggleModule(code: string) {
    setModules((m) => (m.includes(code) ? m.filter((x) => x !== code) : [...m, code]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    const responses: Record<string, string> = {
      "Q3-1": f.siteName, "Q3-2": f.tagline, "Q3-3": f.description,
      "Q3-4": "", "Q3-5": "", "Q3-6": "",
      "Q3-7": f.contactEmail, "Q3-8": f.contactPhone, "Q3-9": f.address,
      "Q2A-1": f.brandUrl,
      "Q4-1": f.yourName, "Q4-3": f.yourEmail, "Q4-4": f.yourPhone, "Q4-5": f.billingEmail,
      "Q5-1": f.visualDirection, "Q5-2": f.siteWords, "Q5-3": "", "Q5-4": f.likedSites,
      "Q6-1": f.siteGoal, "Q6-2": f.primaryAction, "Q6-3": f.standardPages,
      "Q6-4": f.quoteTopics, "Q6-5": f.announcement,
      "Q7A-1": modules.includes("catalog") ? "Yes" : "No",
      "Q7B-1": f.catalogSize, "Q7B-2": f.catalogCategories, "Q7B-3": f.catalogWhereNow,
      "Q8A-1": modules.includes("careers") ? "Yes" : "No",
      "Q9A-1": modules.includes("blog") ? "Yes" : "No", "Q9B-4": f.blogCategories,
      "Q10A-1": modules.includes("gallery") ? "Yes" : "No", "Q10B-1": f.galleryFocus,
      "Q11A-1": f.customFuncYes ? "Yes" : "No", "Q11B-1": f.customFuncDesc,
      "Q12-2": f.contentApprover, "Q12-3": f.contentReady,
      "Q13-1": f.story, "Q13-2": f.different, "Q13-3": f.prospectKnow, "Q13-4": f.trustSignals,
      "Q13-5": f.faq, "Q13-6": f.logos,
      "Q14-1": social.LinkedIn ?? "", "Q14-2": social.Facebook ?? "", "Q14-3": social.Instagram ?? "",
      "Q14-4": social.X ?? "", "Q14-5": social.YouTube ?? "",
      "Q15-3": f.launchEvent, "Q15-4": f.schedulingNotes,
      "Q16A-1": f.discoveryCall ? "Yes" : "No",
      "Q17A-1": f.githubWanted ? "Yes" : "No", "Q17B-1": f.githubUser,
      "Q18-1": f.anythingElse, "Q18-2": f.howHeard,
    };

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setError(data.error ?? "Something went wrong. Please try again or email hello@deneb4.com.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again or email hello@deneb4.com.");
    }
  }

  if (status === "success") {
    return (
      <div className="card p-8">
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>Thanks — we've got it.</h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Check your email for your project portal link and password. We'll review everything and send your quote
          for approval there next.
        </p>
        <a href="/login" className="btn-primary inline-flex">Go to your portal →</a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-10">
      {/* ── Identity & reach ─────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-bold mb-1" style={{ color: "var(--text-heading)" }}>Your business</legend>
        <div>
          <label className={labelCls} style={labelStyle}>Business / site name *</label>
          <input required value={f.siteName} onChange={(e) => set("siteName", e.target.value)} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Tagline</label>
          <input value={f.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="One line describing what you do" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>What does your business do? *</label>
          <textarea required rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="2-3 sentences, for someone who's never heard of you" className={inputCls} style={inputStyle} />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>Public email *</label>
            <input required type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Public phone</label>
            <input value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Business address</label>
            <input value={f.address} onChange={(e) => set("address", e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Current website, if you have one</label>
          <input value={f.brandUrl} onChange={(e) => set("brandUrl", e.target.value)} placeholder="https://" className={inputCls} style={inputStyle} />
        </div>
      </fieldset>

      {/* ── Point of contact ─────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-bold mb-1" style={{ color: "var(--text-heading)" }}>Your point of contact</legend>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>Your name *</label>
            <input required value={f.yourName} onChange={(e) => set("yourName", e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Email for project updates *</label>
            <input required type="email" value={f.yourEmail} onChange={(e) => set("yourEmail", e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Direct phone</label>
            <input value={f.yourPhone} onChange={(e) => set("yourPhone", e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Send invoices to (if different)</label>
          <input type="email" value={f.billingEmail} onChange={(e) => set("billingEmail", e.target.value)} className={inputCls} style={inputStyle} />
        </div>
      </fieldset>

      {/* ── Look & feel ──────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-bold mb-1" style={{ color: "var(--text-heading)" }}>Look &amp; feel</legend>
        <div>
          <label className={labelCls} style={labelStyle}>Which best describes how the site should feel? *</label>
          <select required value={f.visualDirection} onChange={(e) => set("visualDirection", e.target.value)} className={inputCls} style={inputStyle}>
            <option value="">Select one...</option>
            {PAIRING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="match existing brand">Match my existing brand colors</option>
          </select>
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Sites in your industry you like (or dislike)</label>
          <textarea rows={2} value={f.likedSites} onChange={(e) => set("likedSites", e.target.value)} className={inputCls} style={inputStyle} />
        </div>
      </fieldset>

      {/* ── What visitors should do ──────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-bold mb-1" style={{ color: "var(--text-heading)" }}>What visitors should do</legend>
        <div>
          <label className={labelCls} style={labelStyle}>When someone lands on your site, what's the one thing they should do? *</label>
          <input required value={f.primaryAction} onChange={(e) => set("primaryAction", e.target.value)} placeholder="e.g. Request a quote, Call us, Browse products" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>What do people usually ask you to quote? (up to 5, comma-separated)</label>
          <input value={f.quoteTopics} onChange={(e) => set("quoteTopics", e.target.value)} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Anything time-sensitive to announce in a banner at launch?</label>
          <input value={f.announcement} onChange={(e) => set("announcement", e.target.value)} placeholder="Leave blank if none" className={inputCls} style={inputStyle} />
        </div>
      </fieldset>

      {/* ── Pages & features ─────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-bold mb-1" style={{ color: "var(--text-heading)" }}>Pages &amp; features</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {MODULES.map((m) => (
            <label key={m.code} className="flex items-start gap-3 p-3 rounded-sm cursor-pointer" style={{ border: "1px solid var(--border-accent)" }}>
              <input type="checkbox" checked={modules.includes(m.code)} onChange={() => toggleModule(m.code)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold" style={{ color: "var(--text-heading)" }}>{m.label}</span>
                <span className="block text-xs" style={hintStyle}>{m.help}</span>
              </span>
            </label>
          ))}
        </div>
        {modules.includes("catalog") && (
          <div className="grid sm:grid-cols-2 gap-4 pl-1">
            <div>
              <label className={labelCls} style={labelStyle}>Roughly how many products/services?</label>
              <input value={f.catalogSize} onChange={(e) => set("catalogSize", e.target.value)} placeholder="e.g. under 50" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Categories</label>
              <input value={f.catalogCategories} onChange={(e) => set("catalogCategories", e.target.value)} className={inputCls} style={inputStyle} />
            </div>
          </div>
        )}
        <div>
          <label className={labelCls} style={labelStyle}>Is there anything you need the site to <em>do</em> that isn't listed above?</label>
          <label className="flex items-center gap-2 text-sm mb-2" style={{ color: "var(--text-muted)" }}>
            <input type="checkbox" checked={f.customFuncYes} onChange={(e) => set("customFuncYes", e.target.checked)} />
            Yes, there's something custom
          </label>
          {f.customFuncYes && (
            <textarea rows={2} value={f.customFuncDesc} onChange={(e) => set("customFuncDesc", e.target.value)} placeholder="Describe it — we'll follow up with a scoped quote for anything custom" className={inputCls} style={inputStyle} />
          )}
        </div>
      </fieldset>

      {/* ── Content & assets ─────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-bold mb-1" style={{ color: "var(--text-heading)" }}>Content &amp; assets</legend>
        <div>
          <label className={labelCls} style={labelStyle}>Your story, in your own words</label>
          <textarea rows={3} value={f.story} onChange={(e) => set("story", e.target.value)} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>What makes you different?</label>
          <textarea rows={2} value={f.different} onChange={(e) => set("different", e.target.value)} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Questions customers always ask (and your answers)</label>
          <textarea rows={4} value={f.faq} onChange={(e) => set("faq", e.target.value)} placeholder={"Q: How long does a project take?\nA: About six weeks.\n\nQ: Do you deliver?\nA: Yes, within 100 miles."} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Notable clients or partners (comma-separated)</label>
          <input value={f.logos} onChange={(e) => set("logos", e.target.value)} className={inputCls} style={inputStyle} />
        </div>
      </fieldset>

      {/* ── Social ────────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-bold mb-1" style={{ color: "var(--text-heading)" }}>Social profiles (optional)</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          {SOCIAL_PLATFORMS.map((p) => (
            <div key={p}>
              <label className={labelCls} style={labelStyle}>{p}</label>
              <input
                value={social[p] ?? ""}
                onChange={(e) => setSocial((s) => ({ ...s, [p]: e.target.value }))}
                placeholder="https://"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* ── Logistics ─────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-bold mb-1" style={{ color: "var(--text-heading)" }}>Logistics</legend>
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <input type="checkbox" checked={f.githubWanted} onChange={(e) => set("githubWanted", e.target.checked)} />
          I'd like the site's source code transferred to my own GitHub account at handoff
        </label>
        {f.githubWanted && (
          <input value={f.githubUser} onChange={(e) => set("githubUser", e.target.value)} placeholder="Your GitHub username" className={inputCls} style={inputStyle} />
        )}
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <input type="checkbox" checked={f.discoveryCall} onChange={(e) => set("discoveryCall", e.target.checked)} />
          I'd like to book a discovery call before we start
        </label>
        <div>
          <label className={labelCls} style={labelStyle}>Anything else we should know?</label>
          <textarea rows={2} value={f.anythingElse} onChange={(e) => set("anythingElse", e.target.value)} className={inputCls} style={inputStyle} />
        </div>
      </fieldset>

      {error && <p className="text-sm" style={{ color: "#e40014" }}>{error}</p>}

      <button type="submit" disabled={status === "submitting"} className="btn-primary justify-center">
        {status === "submitting" ? "Submitting..." : "Submit project details"}
      </button>
    </form>
  );
}

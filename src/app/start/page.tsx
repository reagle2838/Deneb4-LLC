import type { Metadata } from "next";
import ProjectForm from "./ProjectForm";

export const metadata: Metadata = {
  title: "Start a Project",
  description:
    "Start your website project with Deneb4. Share a quick brief about your business, scope, and timeline, and get a scoped, fixed-price proposal back — usually within a day or two.",
  alternates: { canonical: "https://deneb4.com/start" },
};

const STEPS = [
  { n: "01", t: "You send the brief", d: "The form below — five minutes. The more detail, the faster the turnaround." },
  { n: "02", t: "I scope it", d: "I review and come back with a fixed-price proposal and a clear plan." },
  { n: "03", t: "We build", d: "On approval, we kick off the four-phase process with sign-off at each step." },
];

export default function StartPage() {
  return (
    <section className="bg-grid" style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Left: copy + steps */}
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-5" style={{ color: "var(--accent-light)" }}>Start a Project</p>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-5">Tell me what you make.</h1>
            <p className="text-lg leading-relaxed mb-10" style={{ color: "var(--text-muted)" }}>
              A few details about your business and goals is all it takes to get a useful, scoped proposal back. No obligation, no sales pressure.
            </p>
            <div className="space-y-6">
              {STEPS.map((s) => (
                <div key={s.n} className="flex gap-4">
                  <span className="font-spec text-xl font-bold flex-shrink-0" style={{ color: "var(--accent-light)" }}>{s.n}</span>
                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--text-heading)" }}>{s.t}</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="font-spec text-xs mt-10" style={{ color: "var(--text-faint)" }}>
              Prefer email? hello@deneb4.com · Mon–Fri 9am–5pm EST
            </p>
          </div>

          {/* Right: form */}
          <div className="lg:col-span-3">
            <ProjectForm />
          </div>
        </div>
      </div>
    </section>
  );
}

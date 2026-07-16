import IntakeForm from "./IntakeForm";

export const metadata = {
  title: "Project intake",
  description: "Tell us about your project — this replaces the Google Form.",
};

export default function IntakePage() {
  return (
    <section className="min-h-[calc(100vh-96px)] px-4 py-16" style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto max-w-2xl">
        <p className="font-spec text-xs tracking-widest uppercase mb-3" style={{ color: "var(--accent-light)" }}>
          Project intake
        </p>
        <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-heading)" }}>
          Tell us about your project
        </h1>
        <p className="text-sm mb-10" style={{ color: "var(--text-muted)" }}>
          Already had a discovery call, or ready to get started? This is everything we need to draft your quote and
          build your site. Takes about 10 minutes — you can always add more detail once your project starts.
        </p>
        <IntakeForm />
      </div>
    </section>
  );
}

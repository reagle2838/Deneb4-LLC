import BlueprintDraw from "@/components/motion/BlueprintDraw";

/**
 * Drafting-style section eyebrow: a small crosshair that draws itself,
 * next to a mono spec label ("01 · Capabilities").
 */
export default function SectionEyebrow({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <BlueprintDraw variant="crosshair" size={20} style={{ color: "var(--accent-light)" }} />
      <span
        className="font-spec text-[11px] tracking-[0.25em] uppercase"
        style={{ color: "var(--text-faint)" }}
      >
        {index} · {label}
      </span>
    </div>
  );
}

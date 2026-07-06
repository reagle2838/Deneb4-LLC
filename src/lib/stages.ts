// Build stages shown as a progress bar in the client portal. Mirrors the
// public /process page. A client's `stage` is the label of the current
// stage, or '' for not-yet-started. Kept in its own module (no Node deps)
// so it is safe to import from client components.
export const BUILD_STAGES = ['Discovery & Brief', 'Design', 'Development', 'QA & Launch'] as const;

// Plain-language versions shown to clients in the portal. The canonical
// values above stay unchanged in YAML and the Workspace.
export const PORTAL_STAGE_LABELS: Record<string, string> = {
  'Discovery & Brief': 'Planning',
  Design: 'Design',
  Development: 'Building',
  'QA & Launch': 'Testing & launch',
};

// One-sentence "what's happening now" summaries for the portal banner.
export const PORTAL_STAGE_SUMMARIES: Record<string, string> = {
  'Discovery & Brief': "We're planning your project and pinning down exactly what gets built.",
  Design: "We're designing what your website will look like.",
  Development: "We're building your website right now.",
  'QA & Launch': "We're testing everything and getting ready to launch.",
};

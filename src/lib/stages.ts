// Build stages shown as a progress bar in the client portal. Mirrors the
// public /process page. A client's `stage` is the label of the current
// stage, or '' for not-yet-started. Kept in its own module (no Node deps)
// so it is safe to import from client components.
export const BUILD_STAGES = ['Discovery & Brief', 'Design', 'Development', 'QA & Launch'] as const;

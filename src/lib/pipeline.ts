/**
 * The internal per-client pipeline: where a project stands operationally
 * and which agent owns the current step. Distinct from BUILD_STAGES
 * (the simplified client-facing progress bar in the portal).
 *
 * No Node dependencies: safe to import from client components.
 * Transitions happen only through /api/agents/pipeline so every change
 * lands on the client's agent-ledger channel.
 */

export interface PipelineStage {
  id: string;
  label: string;
  /** Owner-facing: what this stage means and what happens during it. */
  description: string;
  /** Which agent (or Ridhi) owns driving this stage forward. */
  owner: string;
  /** True when leaving this stage requires one of Ridhi's human gates. */
  gated: boolean;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'onboarding',
    label: 'Onboarding',
    description: 'Client created. Intake form and shared Drive folder go out; waiting on their filled-out docs.',
    owner: 'concierge',
    gated: false,
  },
  {
    id: 'intake-review',
    label: 'Intake review',
    description: 'Docs are back. The form is parsed into a build config; anything unclear gets escalated.',
    owner: 'concierge',
    gated: false,
  },
  {
    id: 'building',
    label: 'Building',
    description: 'Assembling the site from the template per the config. QA runs the harness on every change.',
    owner: 'builder',
    gated: false,
  },
  {
    id: 'internal-review',
    label: 'Internal review',
    description: "Ridhi's design and copy review. The client does not see staging until this passes.",
    owner: 'ridhi',
    gated: true,
  },
  {
    id: 'client-review',
    label: 'Client review',
    description: 'Staging is live for the client. Comments get triaged and the change loop runs.',
    owner: 'comms',
    gated: false,
  },
  {
    id: 'approval',
    label: 'Final approval',
    description: 'Sign-off requested from the client on the finished build.',
    owner: 'comms',
    gated: true,
  },
  {
    id: 'payment',
    label: 'Payment',
    description: 'Final invoice sent; waiting for payment. Ridhi confirms before handoff begins.',
    owner: 'billing',
    gated: true,
  },
  {
    id: 'handoff',
    label: 'Handoff',
    description: 'Credentials documented (rotate-before-use), ownership transferred, checklist executed.',
    owner: 'concierge',
    gated: true,
  },
  {
    id: 'complete',
    label: 'Complete',
    description: 'Project done and archived. Maintenance takes over if subscribed.',
    owner: 'maintenance',
    gated: false,
  },
];

export const PIPELINE_IDS = PIPELINE_STAGES.map((s) => s.id);

export function isPipelineStage(id: string): boolean {
  return PIPELINE_IDS.includes(id);
}

export function getPipelineStage(id: string): PipelineStage | null {
  return PIPELINE_STAGES.find((s) => s.id === id) ?? null;
}

export function pipelineLabel(id: string): string {
  return getPipelineStage(id)?.label ?? (id ? id : 'Not set');
}

export function pipelineIndex(id: string): number {
  return PIPELINE_STAGES.findIndex((s) => s.id === id);
}

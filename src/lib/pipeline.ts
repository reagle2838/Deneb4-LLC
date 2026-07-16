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
    description:
      'Docs are back and the quote gate runs here: agent drafts the quote, Ridhi approves (or denies with instructions), the client confirms, the deposit invoice goes out. Deposit PAID starts the build.',
    owner: 'concierge',
    gated: false,
  },
  {
    id: 'building',
    label: 'Building',
    description:
      'Entered automatically when the deposit settles. Assembling the site from the template per the confirmed config; QA runs the harness and green goes straight to client review.',
    owner: 'builder',
    gated: false,
  },
  {
    id: 'internal-review',
    label: 'Internal review',
    description:
      'Legacy stage (Phase 14 folded it into joint final approval). The Builder now skips it; kept for old client records.',
    owner: 'ridhi',
    gated: false,
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
    description:
      'The joint gate: Ridhi advancing a client here IS her final approval; the client signs off via portal Approve or the signed handoff form, which advances to payment automatically.',
    owner: 'comms',
    gated: true,
  },
  {
    id: 'payment',
    label: 'Payment',
    description: 'Invoices are drafted automatically; Ridhi approves each send. All-paid auto-advances to handoff.',
    owner: 'billing',
    gated: false,
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

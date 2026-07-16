/**
 * The Engineer (docs/agents.md, amended + re-approved 2026-07-16): the
 * in-house escalation agent for off-catalog work. Work orders come ONLY
 * from Ridhi; the runner (scripts/engineer.mjs) does the coding on an
 * isolated branch, QAs it, and reports back. QA-green work still waits for
 * her one-click Approve & merge — off-catalog changes are the riskiest in
 * the system, and she only ever reviews green work.
 *
 * Store: content/admin/work-orders/<slug>.json (tracked; work orders are
 * business records, like quotes and billing).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { assertSafeSlug } from '@/lib/agent-auth';

const ORDERS_DIR = path.join(process.cwd(), 'content', 'admin', 'work-orders');
const BUILDS_DIR = path.join(process.cwd(), 'builds');

export type WorkOrderStatus = 'queued' | 'running' | 'review' | 'applied' | 'rejected' | 'failed';

export interface WorkOrder {
  id: string;
  slug: string;
  spec: string;
  status: WorkOrderStatus;
  branch: string;
  summary?: string;
  diffstat?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  history: { at: string; status: WorkOrderStatus; note?: string }[];
}

const ordersPath = (slug: string) => path.join(ORDERS_DIR, `${assertSafeSlug(slug)}.json`);

export function getWorkOrders(slug: string): WorkOrder[] {
  const file = ordersPath(slug);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as WorkOrder[];
  } catch {
    return [];
  }
}

function saveOrders(slug: string, orders: WorkOrder[]) {
  fs.mkdirSync(ORDERS_DIR, { recursive: true });
  fs.writeFileSync(ordersPath(slug), JSON.stringify(orders, null, 2));
}

export function createWorkOrder(slug: string, spec: string): WorkOrder {
  const id = crypto.randomUUID().slice(0, 8);
  const order: WorkOrder = {
    id,
    slug,
    spec: spec.trim().slice(0, 4000),
    status: 'queued',
    branch: `engineer/${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [{ at: new Date().toISOString(), status: 'queued' }],
  };
  saveOrders(slug, [...getWorkOrders(slug), order]);
  return order;
}

export function updateWorkOrder(
  slug: string,
  id: string,
  patch: Partial<Pick<WorkOrder, 'status' | 'summary' | 'diffstat' | 'note'>>
): WorkOrder | null {
  const orders = getWorkOrders(slug);
  const order = orders.find((o) => o.id === id);
  if (!order) return null;
  Object.assign(order, patch);
  order.updatedAt = new Date().toISOString();
  if (patch.status) order.history.push({ at: order.updatedAt, status: patch.status, note: patch.note });
  saveOrders(slug, orders);
  return order;
}

export function countOrdersAwaitingReview(slug: string): number {
  return getWorkOrders(slug).filter((o) => o.status === 'review').length;
}

// ── Git operations for approve/reject (run in builds/<slug>) ────────────

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

export function buildDir(slug: string): string {
  assertSafeSlug(slug);
  return path.join(BUILDS_DIR, slug);
}

/**
 * Merge an Engineer branch into main. Refuses on a dirty tree. Returns the
 * new main short-sha.
 */
export function mergeEngineerBranch(slug: string, branch: string): { ok: true; sha: string } | { ok: false; detail: string } {
  const dir = buildDir(slug);
  if (!fs.existsSync(path.join(dir, '.git'))) return { ok: false, detail: `builds/${slug} is not a git repo.` };
  if (!/^engineer\/[a-z0-9-]+$/.test(branch)) return { ok: false, detail: 'Not an engineer branch.' };
  if (git(['status', '--porcelain'], dir).length > 0) {
    return { ok: false, detail: 'The client repo has uncommitted changes; resolve them first.' };
  }
  try {
    git(['checkout', 'main'], dir);
    git(
      ['-c', 'user.name=Deneb4 Engineer', '-c', 'user.email=agents@deneb4.com', 'merge', '--no-ff', branch, '-m', `Merge ${branch} (approved by Ridhi)`],
      dir
    );
    git(['branch', '-D', branch], dir);
    return { ok: true, sha: git(['rev-parse', '--short', 'HEAD'], dir) };
  } catch (err) {
    // Leave the repo on main regardless.
    try { git(['merge', '--abort'], dir); } catch { /* not mid-merge */ }
    try { git(['checkout', 'main'], dir); } catch { /* already there */ }
    return { ok: false, detail: `Merge failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Delete a rejected Engineer branch. */
export function deleteEngineerBranch(slug: string, branch: string): boolean {
  const dir = buildDir(slug);
  if (!/^engineer\/[a-z0-9-]+$/.test(branch)) return false;
  try {
    git(['checkout', 'main'], dir);
    git(['branch', '-D', branch], dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Push main to origin using the token-embed + no-credential-helper + scrub
 * doctrine (same as the Builder's push layer). No-op without config.
 */
export function pushMain(slug: string): { pushed: boolean; detail: string } {
  const dir = buildDir(slug);
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  if (!token || !owner) return { pushed: false, detail: 'GITHUB_TOKEN/GITHUB_OWNER not configured; local repo only.' };
  const repo = `d4-client-${slug}`;
  try {
    const remotes = git(['remote'], dir);
    if (!remotes.split(/\r?\n/).includes('origin')) {
      return { pushed: false, detail: 'No origin remote; run a Builder push first.' };
    }
    git(['remote', 'set-url', 'origin', `https://x-access-token:${token}@github.com/${owner}/${repo}.git`], dir);
    git(['-c', 'credential.helper=', 'push', '--quiet', 'origin', 'main'], dir);
    git(['remote', 'set-url', 'origin', `https://github.com/${owner}/${repo}.git`], dir);
    return { pushed: true, detail: `Pushed to ${owner}/${repo}.` };
  } catch (err) {
    try { git(['remote', 'set-url', 'origin', `https://github.com/${owner}/${repo}.git`], dir); } catch { /* keep going */ }
    return { pushed: false, detail: `Push failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

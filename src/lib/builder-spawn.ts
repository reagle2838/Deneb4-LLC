/**
 * Fire-and-forget Builder launch, shared by every agent path that starts a
 * build (approved change proposals, deposit-settled build starts). The
 * Builder reports green/red to the ledger itself and auto-reverts a change
 * QA rejects. Gated on BUILDER_AUTORUN=true like the original changes-route
 * path; callers get a human-readable note either way.
 */
import path from 'path';
import { spawn } from 'child_process';

export function spawnBuilder(slug: string, origin?: string): { started: boolean; note: string } {
  if (process.env.BUILDER_AUTORUN !== 'true') {
    return { started: false, note: `Config ready. Run: npm run builder -- ${slug} --report-to <origin>` };
  }
  const reportTo = origin || process.env.SITE_URL || '';
  const args = [path.join(process.cwd(), 'scripts', 'build-client.mjs'), slug];
  if (reportTo) args.push('--report-to', reportTo);
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, NODE_OPTIONS: '--use-system-ca' },
  });
  child.unref();
  return {
    started: true,
    note: `Builder started in the background${reportTo ? '' : ' (no report origin; QA results log locally)'}; its result will appear on this channel.`,
  };
}

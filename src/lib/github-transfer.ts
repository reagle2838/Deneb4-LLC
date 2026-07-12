/**
 * Token-gated GitHub repo transfer at handoff: hand the client their own
 * repo so they truly own the code. Dormant until GITHUB_TOKEN + GITHUB_OWNER
 * are set (the same credential the Builder's push layer waits on) and the
 * repo was actually pushed. GitHub's transfer is asynchronous (202) and the
 * client accepts it from their side — which is exactly what you want at a
 * handoff. Server-only.
 */

export interface TransferResult {
  transferred: boolean;
  detail: string;
}

export async function transferRepoToClient(slug: string, newOwner: string): Promise<TransferResult> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  if (!token || !owner) {
    return {
      transferred: false,
      detail: 'GitHub not configured (GITHUB_TOKEN/GITHUB_OWNER); repo transfer is dormant. The repo stays with Deneb4 until this is set.',
    };
  }
  if (!newOwner) {
    return { transferred: false, detail: "No client GitHub username on file; can't transfer. Add it to the client record first." };
  }
  const repo = `d4-client-${slug}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'deneb4-handoff',
      },
      body: JSON.stringify({ new_owner: newOwner }),
    });
    if (res.status === 404) {
      return { transferred: false, detail: `Repo ${owner}/${repo} not found on GitHub — was it pushed? Nothing to transfer.` };
    }
    if (res.status !== 202 && !res.ok) {
      return { transferred: false, detail: `Transfer request failed (HTTP ${res.status}).` };
    }
    return {
      transferred: true,
      detail: `Transfer of ${owner}/${repo} to @${newOwner} initiated. GitHub emails them to accept — the repo is theirs once they do.`,
    };
  } catch (err) {
    return { transferred: false, detail: `Transfer failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

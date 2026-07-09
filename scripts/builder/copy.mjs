/**
 * Copy resolution + the optional LLM refinement seam (hybrid architecture).
 *
 * resolveDeterministicCopy is the reliable ground truth: it maps enabled
 * modules' slots to the facts the client supplied, nothing else.
 *
 * refineCopy is the OPTIONAL, key-gated, rephrase-only layer. It is a literal
 * no-op passthrough unless ANTHROPIC_API_KEY is set, so the deterministic core
 * is complete without any key. It may only rephrase the wording of existing
 * slot VALUES using only the supplied facts; it can never touch structure,
 * add slots, or invent facts, and any structural drift is rejected in favor of
 * the deterministic map.
 */

/**
 * @param {import('./types.mjs').BuildConfig} cfg
 * @param {import('./types.mjs').TemplateDescriptor} template
 * @returns {Record<string, string>}   slotId -> value (only supplied, non-empty)
 */
export function resolveDeterministicCopy(cfg, template) {
  const enabled = Object.keys(template.modules).filter((k) => cfg.modules[k] === true);
  /** @type {Record<string, string>} */
  const slots = {};
  for (const key of enabled) {
    for (const slotId of Object.keys(template.modules[key].slots)) {
      const v = cfg.copy[slotId];
      if (typeof v === 'string' && v.length > 0) slots[slotId] = v;
    }
  }
  return { ...slots, siteName: cfg.siteName };
}

/**
 * @param {Record<string,string>} slots
 * @param {Record<string,string>} facts   client-supplied ground truth
 * @param {{ apiKey?: string, model?: string, timeoutMs?: number }} [opts]
 * @returns {Promise<Record<string,string>>}
 */
export async function refineCopy(slots, facts, opts = {}) {
  const key = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) return slots; // no-op: deterministic core is complete without a key

  try {
    const refined = await callAnthropic(key, slots, facts, opts);
    // Structure guardrail: keys must match exactly, or fall back to deterministic.
    const inKeys = Object.keys(slots);
    const sameKeys =
      Object.keys(refined).length === inKeys.length && inKeys.every((k) => k in refined);
    if (!sameKeys) return slots;
    for (const k of inKeys) if (typeof refined[k] !== 'string' || !refined[k]) return slots;
    return refined;
  } catch {
    return slots; // any failure -> deterministic
  }
}

/** Thin, dependency-free call to the Anthropic Messages API. */
async function callAnthropic(key, slots, facts, opts) {
  const model = opts.model ?? 'claude-sonnet-5';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content:
              'Rephrase ONLY the wording of these website copy values to be crisp and professional. ' +
              'Use ONLY the facts provided; do not add, infer, or invent any fact, number, date, or claim. ' +
              'Return a JSON object with EXACTLY the same keys and no others, values as strings.\n\n' +
              'Facts (ground truth):\n' + JSON.stringify(facts, null, 2) + '\n\n' +
              'Copy values to rephrase:\n' + JSON.stringify(slots, null, 2) + '\n\n' +
              'Return only the JSON object.',
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    const text = (data.content || []).map((b) => b.text || '').join('');
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : slots;
  } finally {
    clearTimeout(t);
  }
}

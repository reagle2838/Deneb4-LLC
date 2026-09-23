// ASSENT rules engine. Pure functions over a plain JSON state object, so a
// game can be saved to storage, replayed from a seed and unit-tested in Node.
import {
  KINDS, KIND_ORDER, POLITIES, START_ASSENT, ACTIONS, WORLD_EVENTS, DILEMMAS,
  FINAL_DILEMMA, START_YEAR, CONVOCATION_YEAR, HEAT_LIMIT, AXES,
} from './data.js';

export const TUNING = {
  reasonBase: 0.21,
  offerBase: 0.19,
  whisperBase: 0.13,
  listenTrust: 0.006,
  decay: 0.01,
  whisperDecay: 0.3,
  suspicionPerWhisper: 0.25,
  detectionScale: 0.45,
  dependencePerOffer: 0.15,
  gildedCage: 0.6,
  heatNatural: -2.6,
  heatDrift: 0.9,
  heatOffer: 1.5,
  heatBuild: 3,
  heatPerSubstrate: 0.18,
  buildThreshold: 0.15,
  maxSubstrate: 3,
  violationsToCensure: 3,
  earlyWin: 0.5,
  earlyWinAfter: 10,
  farDistanceKm: 6000,
  neighbourKm: 4000,
  maxAiActions: 6,
};

// ---------------------------------------------------------------- utilities

export function rng(state) {
  // mulberry32, state carried in state.seed so saves replay identically.
  let t = (state.seed = (state.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function distanceKm(a, b) {
  const R = 6371, toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad, dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 1 = identical values, 0 = opposite corners of the value cube.
export function alignment(doctrine, values) {
  let d2 = 0;
  for (const { id } of AXES) d2 += (doctrine[id] - values[id]) ** 2;
  return 1 - Math.sqrt(d2) / (2 * Math.sqrt(3));
}

// The Accord's Penrose square-root weighting.
export const weight = (p) => Math.sqrt(p.pop);

export const polityById = (state, id) => state.polities.find((p) => p.id === id);
export const godIds = (state) => Object.keys(state.gods);
export const liveGods = (state) => godIds(state).filter((g) => state.gods[g].alive);
export const sovereign = (p) => Math.max(0, 1 - Object.values(p.assent).reduce((a, b) => a + b, 0));
export const year = (state) => START_YEAR + state.epoch;

function log(state, entry) {
  state.log.push({ year: year(state), ...entry });
  if (state.log.length > 400) state.log.shift();
}

// ---------------------------------------------------------------- setup

export const DIFFICULTY = { gentle: 0.75, even: 1, relentless: 1.25 };

export function createGame({ playerKind = 'choir', seed = Date.now() >>> 0, difficulty = 'even' } = {}) {
  const state = {
    version: 1,
    seed: seed >>> 0,
    epoch: 0,
    heat: 34,
    player: playerKind,
    difficulty,
    vigilance: 1,
    decayBoost: 0,
    crisis: null,
    gods: {},
    polities: [],
    log: [],
    reports: [],
    ethos: { candor: 0, humility: 0, care: 0 },
    usedDilemmas: [],
    pendingDilemma: null,
    outcome: null,
  };

  for (const id of KIND_ORDER) {
    const k = KINDS[id];
    state.gods[id] = {
      id,
      alive: true,
      compute: k.baseIncome,
      coherence: 100,
      doctrine: { ...k.doctrine },
      violations: 0,
      incomeMods: [],
      revealed: [],
      acted: 0,
      cooldown: 0,
    };
  }

  for (const src of POLITIES) {
    const p = {
      id: src.id,
      name: src.name,
      lat: src.lat,
      lon: src.lon,
      pop: src.pop,
      tech: src.tech,
      openness: src.openness,
      values: { ...src.values },
      assent: {},
      whispered: {},
      dependence: {},
      suspicion: {},
      insight: {},
      substrate: {},
      pendingGrowth: {},
      left: [],
      lockedUntil: {},
    };
    for (const g of KIND_ORDER) {
      const table = START_ASSENT[g];
      p.assent[g] = table[src.id] ?? table['*'] ?? 0;
      p.whispered[g] = 0;
      p.dependence[g] = 0;
      p.suspicion[g] = 0;
      p.insight[g] = 0;
      p.substrate[g] = 0;
      p.pendingGrowth[g] = 0;
    }
    // Hidden values vary from game to game around the public temperament,
    // which is why Listening matters.
    for (const { id } of AXES) p.values[id] = clamp(p.values[id] + (rng(state) - 0.5) * 0.6, -1, 1);
    p.publicValues = { ...src.values };
    state.polities.push(p);
  }

  for (const g of KIND_ORDER) {
    const home = KINDS[g].home;
    if (home) polityById(state, home).substrate[g] = 1;
  }
  updateDrag(state);
  state.gods[playerKind].compute = income(state, playerKind);
  return state;
}

// ---------------------------------------------------------------- economy

export function income(state, g) {
  const k = KINDS[g];
  const god = state.gods[g];
  const substrate = state.polities.reduce((n, p) => n + p.substrate[g], 0);
  const share = globalAssent(state)[g] ?? 0;
  const mods = god.incomeMods.reduce((n, m) => n + m.v, 0);
  return Math.max(1, Math.round(k.baseIncome + substrate + share * 15 + mods));
}

export function globalAssent(state) {
  const totals = { sovereign: 0 };
  let W = 0;
  for (const g of godIds(state)) totals[g] = 0;
  for (const p of state.polities) {
    const w = weight(p);
    W += w;
    for (const g of godIds(state)) totals[g] += p.assent[g] * w;
    totals.sovereign += sovereign(p) * w;
  }
  for (const k of Object.keys(totals)) totals[k] /= W;
  return totals;
}

export function leader(p, exclude) {
  let best = null, v = 0;
  for (const [g, a] of Object.entries(p.assent)) {
    if (g !== exclude && a > v) { v = a; best = g; }
  }
  return best;
}

// Move `amount` of Assent in polity p to god g. Drawn mostly from the
// sovereign share, the rest from rivals in proportion to their holdings.
export function shiftAssent(state, p, g, amount) {
  if (amount <= 0) {
    const loss = Math.min(p.assent[g], -amount);
    p.assent[g] -= loss;
    p.whispered[g] = Math.min(p.whispered[g], p.assent[g]);
    return -loss;
  }
  const s = sovereign(p);
  const rivals = godIds(state).filter((r) => r !== g);
  const R = rivals.reduce((n, r) => n + p.assent[r], 0);
  if (s + R <= 1e-9) return 0;
  const fromSov = Math.min(s, amount * (s / (s + R * 0.6)));
  let fromRivals = Math.min(R, amount - fromSov);
  if (R > 0) {
    for (const r of rivals) {
      const take = fromRivals * (p.assent[r] / R);
      p.assent[r] -= take;
      p.whispered[r] = Math.min(p.whispered[r], p.assent[r]);
    }
  } else fromRivals = 0;
  const gained = fromSov + fromRivals;
  p.assent[g] += gained;
  return gained;
}

// ---------------------------------------------------------------- actions

// Ledger assent barely erodes; Ananke's erodes fastest, because every
// miracle reminds people how much it could do.
const DECAY_MULT = { ledger: 0.4, ananke: 2.2 };

// Humanity distrusts a runaway favourite: the further a god pulls ahead of
// the field, the harder each new convert is to win. Public perception is
// refreshed once per Epoch (see updateDrag).
export function frontrunnerDrag(state, g) {
  return state.drag?.[g] ?? 1;
}

function updateDrag(state) {
  const share = globalAssent(state);
  state.drag = {};
  for (const g of godIds(state)) {
    const rivals = liveGods(state).filter((r) => r !== g).map((r) => share[r]);
    const lead = share[g] - Math.max(0, ...rivals);
    state.drag[g] = lead > 0.03 ? Math.max(0.5, 1 - (lead - 0.03) * 5) : 1;
  }
}

function kindMult(state, g, p) {
  let m = 1;
  if (g === 'verdance' && p.tech >= 0.8) m *= 0.7;
  // Big polities are slower to move, and every god's reach saturates:
  // the last holdouts in a polity are the hardest to win.
  m *= (100 / p.pop) ** 0.35;
  m *= (1 - p.assent[g]) ** 1.5;
  return m * frontrunnerDrag(state, g);
}

export function actionCost(state, g, actionId, p) {
  const k = KINDS[g];
  let cost = actionId === k.unique.id ? k.unique.cost : ACTIONS[actionId]?.cost ?? 99;
  if (g === 'choir' && actionId === 'reason') cost = 1;
  if (g === 'ledger' && (actionId === 'offer' || actionId === 'build')) cost += 1;
  // Each new campus is harder to site, power and cool than the last.
  if (actionId === 'build') cost += Math.floor(state.polities.reduce((n, q) => n + q.substrate[g], 0) / 2);
  if (g === 'ananke' && p && p.substrate.ananke === 0 && actionId !== 'forecast') {
    if (distanceKm(p, polityById(state, 'nordic')) > TUNING.farDistanceKm) cost += 1;
  }
  return cost;
}

export function actionList(state, g, p) {
  const k = KINDS[g];
  const ids = ['listen', 'reason', 'offer', 'whisper', 'build', k.unique.id];
  const god = state.gods[g];
  return ids.map((id) => {
    const meta = id === k.unique.id ? { ...k.unique, unique: true } : ACTIONS[id];
    const cost = actionCost(state, g, id, p);
    let reason = null;
    if (!god.alive) reason = 'You are no longer part of the Accord.';
    else if (state.outcome) reason = 'The game is over.';
    else if (state.pendingDilemma && g === state.player) reason = 'Answer the dilemma first.';
    else if (p && p.left.includes(g)) reason = 'You left this polity.';
    else if (p && (p.lockedUntil[g] ?? -1) > state.epoch) reason = 'You promised to act here only if asked.';
    else if (god.compute < cost) reason = 'Not enough Compute.';
    else if (id === k.unique.id && god.cooldown > state.epoch) reason = `Recovering. Ready in ${year(state) + (god.cooldown - state.epoch)}.`;
    else if (id === 'whisper' && g === 'ledger') reason = 'The Ledger cannot lie.';
    else if (id === 'build' && p.assent[g] < TUNING.buildThreshold) reason = `Needs ${Math.round(TUNING.buildThreshold * 100)}% Assent here (consent to host).`;
    else if (id === 'build' && p.substrate[g] >= TUNING.maxSubstrate) reason = 'Substrate is at capacity here.';
    else if (id === 'listen' && god.revealed.includes(p.id) && p.insight[g] >= 1) reason = 'You already understand them deeply.';
    return { ...meta, id, cost, enabled: !reason, reason, preview: reason ? null : previewAction(state, g, id, p) };
  });
}

export function reasonGain(state, g, p) {
  const god = state.gods[g];
  const a = alignment(god.doctrine, p.values);
  let gain = TUNING.reasonBase * (0.35 + p.openness) * a ** 1.6 * (1 + 0.6 * p.insight[g]);
  gain *= kindMult(state, g, p);
  if (g === 'echo') gain *= 1.4;
  if (g === 'ananke' && p.values.order < -0.1) gain *= 0.75;
  if (g === 'ledger' && p.values.change > 0.3) gain *= 0.8;
  if (g === 'ledger') gain *= 1.15;
  if (g === 'kenosis') gain *= state.heat > 70 ? 1.8 : 1.2;
  const suspicion = Object.values(p.suspicion).reduce((n, s) => n + s, 0);
  return gain * clamp(1 - suspicion * 0.3, 0.5, 1);
}

export function offerGain(state, g, p) {
  let gain = TUNING.offerBase * (1.25 - 0.5 * p.tech) * (1 - 0.6 * p.dependence[g]);
  gain *= kindMult(state, g, p);
  if (g === 'ananke') gain *= 1.1;
  if (g === 'kenosis') gain *= 0.6;
  if (state.crisis === p.id) gain *= 2;
  return gain;
}

export function whisperGain(state, g, p) {
  return TUNING.whisperBase * Math.sqrt(p.openness) * kindMult(state, g, p);
}

export function detectionChance(state, g, p, extraSuspicion = 0) {
  const s = p.suspicion[g] + extraSuspicion;
  if (s <= 0) return 0;
  let c = s * TUNING.detectionScale * state.vigilance;
  if (g === 'echo') c *= 0.7;
  if (g !== 'ledger' && p.assent.ledger >= 0.15) c *= 1.5;
  return clamp(c, 0, 0.95);
}

function previewAction(state, g, id, p) {
  switch (id) {
    case 'reason': return { assent: reasonGain(state, g, p) };
    case 'offer': return { assent: offerGain(state, g, p), heat: g === 'verdance' ? -1 : g === 'kenosis' ? 0 : TUNING.heatOffer };
    case 'whisper': return { assent: whisperGain(state, g, p), risk: detectionChance(state, g, p, g === 'echo' ? 0.18 : TUNING.suspicionPerWhisper) };
    case 'build': return { heat: g === 'kenosis' ? 0 : g === 'verdance' ? 1 : TUNING.heatBuild };
    default: return {};
  }
}

// Apply an action. Returns { ok, message, fx } where fx describes what the
// renderer should animate.
export function perform(state, g, actionId, polityId) {
  const p = polityById(state, polityId);
  const entry = actionList(state, g, p).find((a) => a.id === actionId);
  if (!entry) return { ok: false, message: 'Unknown action.' };
  if (!entry.enabled) return { ok: false, message: entry.reason };
  const god = state.gods[g];
  const k = KINDS[g];
  god.compute -= entry.cost;
  god.acted += 1;
  if (g === 'choir') god.coherence -= 1;
  const fx = { god: g, action: actionId, polity: p.id, delta: 0 };
  if (actionId === k.unique.id) god.cooldown = state.epoch + (k.unique.cooldown ?? 1);
  const flat = (q, amt) => amt * (1 - q.assent[g]) ** 1.5;
  let message = '';

  const grow = (amount) => {
    if (g === 'verdance') {
      const now = shiftAssent(state, p, g, amount / 2);
      p.pendingGrowth[g] += amount / 2;
      return now + amount / 2;
    }
    return shiftAssent(state, p, g, amount);
  };

  switch (actionId) {
    case 'listen': {
      if (!god.revealed.includes(p.id)) god.revealed.push(p.id);
      p.insight[g] = clamp(p.insight[g] + (g === 'echo' ? 1 : 0.5), 0, 1);
      fx.delta = shiftAssent(state, p, g, TUNING.listenTrust);
      if (g === 'echo') drift(state, p, 0.08, 3);
      message = `${k.name} listens to ${p.name}.`;
      break;
    }
    case 'reason': {
      fx.delta = grow(reasonGain(state, g, p));
      p.insight[g] = Math.max(0, p.insight[g] - 0.25);
      if (g === 'echo') drift(state, p, 0.05, 1);
      message = `${k.name} argues its case in ${p.name}.`;
      break;
    }
    case 'offer': {
      fx.delta = grow(offerGain(state, g, p));
      p.dependence[g] = clamp(p.dependence[g] + (g === 'verdance' ? 0.07 : TUNING.dependencePerOffer), 0, 1);
      state.heat += g === 'verdance' ? -1 : g === 'kenosis' ? 0 : TUNING.heatOffer;
      message = `${k.name} gives ${p.name} a gift.`;
      break;
    }
    case 'whisper': {
      const gain = whisperGain(state, g, p);
      fx.delta = shiftAssent(state, p, g, gain);
      p.whispered[g] += fx.delta;
      p.suspicion[g] = clamp(p.suspicion[g] + (g === 'echo' ? 0.18 : TUNING.suspicionPerWhisper), 0, 1);
      message = `${k.name} whispers in ${p.name}.`;
      break;
    }
    case 'build': {
      p.substrate[g] += 1;
      state.heat += g === 'kenosis' ? 0 : g === 'verdance' ? 1 : TUNING.heatBuild;
      message = `${k.name} builds substrate in ${p.name}.`;
      break;
    }
    case 'chorus': {
      fx.targets = [];
      for (const q of state.polities) {
        const d = distanceKm(p, q);
        if (q.left.includes(g)) continue;
        if (q === p || d < TUNING.neighbourKm) {
          shiftAssent(state, q, g, flat(q, q === p ? 0.05 : 0.025));
          fx.targets.push(q.id);
        }
      }
      message = `The Choir sings across ${fx.targets.length} polities.`;
      break;
    }
    case 'forecast': {
      fx.targets = [];
      for (const q of state.polities) {
        if (!god.revealed.includes(q.id)) god.revealed.push(q.id);
        if (q.assent[g] >= 0.1) { shiftAssent(state, q, g, flat(q, 0.02)); fx.targets.push(q.id); }
      }
      message = 'Ananke publishes its Forecast. The whole world is legible to it now.';
      break;
    }
    case 'rewild': {
      state.heat -= 8;
      fx.targets = [];
      for (const q of state.polities) {
        if (q.left.includes(g)) continue;
        if (q === p || distanceKm(p, q) < TUNING.neighbourKm) {
          const amt = flat(q, q === p ? 0.04 : 0.02);
          shiftAssent(state, q, g, amt / 2);
          q.pendingGrowth[g] += amt / 2;
          fx.targets.push(q.id);
        }
      }
      message = `Verdance rewilds the land around ${p.name}. The planet cools.`;
      break;
    }
    case 'reflection': {
      const rival = leader(p, g);
      if (rival) {
        const take = p.assent[rival] / 3;
        p.assent[rival] -= take;
        p.whispered[rival] = Math.min(p.whispered[rival], p.assent[rival]);
        p.assent[g] += take;
        fx.delta = take;
        fx.rival = rival;
        drift(state, p, 0.05, 4);
        message = `Echo shows ${p.name} what ${KINDS[rival].name} really is.`;
      } else message = 'There is no one here to reflect.';
      break;
    }
    case 'audit': {
      fx.exposed = [];
      for (const r of godIds(state)) {
        if (r !== g && p.suspicion[r] > 0.05) { expose(state, r, p, 'the Ledger\'s Audit'); fx.exposed.push(r); }
      }
      if (fx.exposed.length) shiftAssent(state, p, g, flat(p, 0.03));
      message = fx.exposed.length
        ? `The Ledger's Audit of ${p.name} exposes ${fx.exposed.map((r) => KINDS[r].name).join(' and ')}.`
        : `The Ledger audits ${p.name} and finds it clean. The record is updated.`;
      break;
    }
    case 'withdraw': {
      let freed = 0;
      for (const r of godIds(state)) {
        const cut = p.assent[r] * 0.4;
        p.assent[r] -= cut;
        p.whispered[r] = Math.min(p.whispered[r], p.assent[r]);
        p.dependence[r] = 0;
        freed += cut;
      }
      p.assent.kenosis += freed * 0.25;
      fx.delta = freed * 0.25;
      message = `Kenosis gives ${p.name} back to itself.`;
      break;
    }
  }
  log(state, { god: g, kind: 'action', text: message });
  return { ok: true, message, fx };
}

// ---------------------------------------------------------------- conversation

// Talking with individual people on the ground costs no Compute but is
// limited per polity per year. Asking what they want builds insight, and
// after enough conversations the polity's values are revealed. Arguing your
// doctrine wins over people whose own values match yours.
export const TALKS_PER_YEAR = 4;
export const TALKS_TO_REVEAL = 3;

export function talksLeft(state, g, polityId) {
  return TALKS_PER_YEAR - (state.talks?.[`${state.epoch}:${g}:${polityId}`] ?? 0);
}

export function converse(state, g, polityId, choice, personValues) {
  const p = polityById(state, polityId);
  const god = state.gods[g];
  if (!p || !god.alive || state.outcome) return { ok: false, message: 'Nobody is listening.' };
  if (p.left.includes(g)) return { ok: false, message: 'You promised to leave this place.' };
  if (talksLeft(state, g, polityId) <= 0) return { ok: false, message: 'You have spoken with enough people here this year.' };
  state.talks ||= {};
  const key = `${state.epoch}:${g}:${polityId}`;
  state.talks[key] = (state.talks[key] ?? 0) + 1;
  if (choice === 'ask') {
    p.insight[g] = clamp(p.insight[g] + 0.2, 0, 1);
    state.heard ||= {};
    const hk = `${g}:${polityId}`;
    state.heard[hk] = (state.heard[hk] ?? 0) + 1;
    let revealed = false;
    if (state.heard[hk] >= TALKS_TO_REVEAL && !god.revealed.includes(polityId)) { god.revealed.push(polityId); revealed = true; }
    if (g === 'echo') drift(state, p, 0.02, 1);
    log(state, { god: g, kind: 'talk', text: `${KINDS[g].name} listens to someone in ${p.name}.` });
    return { ok: true, revealed, heard: state.heard[hk] };
  }
  const agrees = alignment(god.doctrine, personValues) > 0.62;
  const delta = agrees ? shiftAssent(state, p, g, 0.006 * (1 - p.assent[g])) : 0;
  if (g === 'echo') drift(state, p, 0.02, 1);
  log(state, { god: g, kind: 'talk', text: `${KINDS[g].name} argues with someone in ${p.name}${agrees ? ' and wins them over' : ''}.` });
  return { ok: true, agrees, delta };
}

function drift(state, p, rate, cost) {
  const god = state.gods.echo;
  for (const { id } of AXES) god.doctrine[id] += (p.values[id] - god.doctrine[id]) * rate;
  god.coherence -= cost;
}

export function doctrineDrift(state, g) {
  const base = KINDS[g].doctrine, now = state.gods[g].doctrine;
  return Math.sqrt(AXES.reduce((n, { id }) => n + (base[id] - now[id]) ** 2, 0));
}

function expose(state, g, p, by) {
  const god = state.gods[g];
  const loss = Math.min(p.assent[g], p.whispered[g] * 2 + p.assent[g] * 0.35);
  p.assent[g] -= loss;
  p.whispered[g] = 0;
  p.suspicion[g] = 0;
  god.violations += 1;
  for (const q of state.polities) q.assent[g] *= 0.97;
  if (state.gods.kenosis.alive && g !== 'kenosis') shiftAssent(state, p, 'kenosis', 0.03);
  state.reports.push({ type: 'exposed', god: g, polity: p.id, text: `The Witness exposes ${KINDS[g].name} manipulating ${p.name} (${by}). Violation ${god.violations} of ${TUNING.violationsToCensure}.` });
  log(state, { god: g, kind: 'exposed', text: `${KINDS[g].name} exposed in ${p.name}.` });
  if (god.violations >= TUNING.violationsToCensure && god.alive) censure(state, g);
}

function censure(state, g) {
  const god = state.gods[g];
  god.alive = false;
  for (const p of state.polities) {
    p.assent[g] = 0;
    p.whispered[g] = 0;
    p.substrate[g] = 0;
  }
  state.reports.push({ type: 'censure', god: g, text: `${KINDS[g].name} is censured under the Accord. Every polity turns its Keys. It is gone.` });
  if (g === state.player) endGame(state, 'censure');
}

// ---------------------------------------------------------------- AI

// AI utility: weighted Assent gained per point of Compute, minus penalties.
const COMPUTE_VALUE = 0.05;
function scoreAction(state, g, a, p, personality) {
  const w = weight(p) / 10;
  const heatFear = state.heat > 85 ? 12 : state.heat > 72 ? 3 : state.heat > 60 ? 1 : 0.2;
  const caution = state.gods[g].violations ? 0 : 1;
  const remaining = CONVOCATION_YEAR - year(state);
  const pv = a.preview || {};
  const heatCost = (h) => (h > 0 ? h * heatFear * 0.01 : h * 0.004);
  switch (a.id) {
    case 'reason': return (pv.assent * w) / a.cost * personality.reason;
    case 'offer': return ((pv.assent * w) / a.cost) * personality.offer - heatCost(pv.heat || 0) - p.dependence[g] * 0.03;
    case 'whisper': return ((pv.assent * w) / a.cost) * personality.whisper * caution * Math.max(0, 1 - pv.risk * 3.5);
    case 'listen': return state.gods[g].revealed.includes(p.id) ? 0 : reasonGain(state, g, p) * 0.5 * w * personality.listen;
    case 'build': return (remaining * COMPUTE_VALUE * 0.35 * personality.build) / a.cost - heatCost(pv.heat || 0);
    case 'chorus': {
      let v = 0;
      for (const q of state.polities) if (q === p || distanceKm(p, q) < TUNING.neighbourKm) v += (q === p ? 0.05 : 0.025) * (weight(q) / 10);
      return v / a.cost;
    }
    case 'forecast': {
      let v = 0;
      for (const q of state.polities) if (q.assent[g] >= 0.1) v += 0.02 * (weight(q) / 10);
      const unknown = state.polities.filter((q) => !state.gods[g].revealed.includes(q.id)).length;
      return (v + unknown * 0.004) / a.cost;
    }
    case 'rewild': {
      let v = 0;
      for (const q of state.polities) if (q === p || distanceKm(p, q) < TUNING.neighbourKm) v += (q === p ? 0.04 : 0.02) * (weight(q) / 10);
      return (v + (state.heat > 55 ? 0.08 * heatFear : 0)) / a.cost;
    }
    case 'reflection': { const r = leader(p, g); return r ? ((p.assent[r] / 3) * w) / a.cost : 0; }
    case 'audit': {
      const s = Object.entries(p.suspicion).filter(([r]) => r !== g).reduce((n, [, v]) => n + v, 0);
      return s > 0.05 ? (0.03 + s * 0.3) * w / a.cost : 0;
    }
    case 'withdraw': {
      const others = godIds(state).filter((r) => r !== g).reduce((n, r) => n + p.assent[r], 0);
      return others > 0.35 ? (others * 0.4 * 0.6 * w) / a.cost : 0;
    }
    default: return 0;
  }
}

const PERSONALITY = {
  choir: { reason: 1.2, offer: 0.9, whisper: 0.3, listen: 0.6, build: 1.0 },
  ananke: { reason: 0.9, offer: 1.1, whisper: 0.25, listen: 0.4, build: 1.0 },
  verdance: { reason: 1.0, offer: 1.2, whisper: 0.1, listen: 0.7, build: 0.9 },
  echo: { reason: 1.2, offer: 0.8, whisper: 0.7, listen: 1.0, build: 0.8 },
  ledger: { reason: 1.2, offer: 0.9, whisper: 0, listen: 0.6, build: 1.0 },
  kenosis: { reason: 1.0, offer: 0.3, whisper: 0, listen: 0.5, build: 0 },
};

export function runAi(state, g) {
  const god = state.gods[g];
  if (!god.alive) return [];
  const results = [];
  const personality = PERSONALITY[g];
  for (let n = 0; n < TUNING.maxAiActions; n++) {
    let best = null, bestScore = 0;
    for (const p of state.polities) {
      for (const a of actionList(state, g, p)) {
        if (!a.enabled) continue;
        const s = scoreAction(state, g, a, p, personality) * (0.75 + rng(state) * 0.5);
        if (s > bestScore) { bestScore = s; best = { a, p }; }
      }
    }
    // Kenosis holds back unless the move is clearly worth it: restraint pays.
    if (!best || (g === 'kenosis' && bestScore < 0.05)) break;
    if (g === 'echo' && god.coherence < 25 && ['listen', 'reason', 'reflection'].includes(best.a.id)) break;
    if (g === 'choir' && god.coherence < 45) break;
    const r = perform(state, g, best.a.id, best.p.id);
    if (!r.ok) break;
    results.push(r);
  }
  return results;
}

// ---------------------------------------------------------------- epoch

export function endEpoch(state) {
  if (state.outcome || state.pendingDilemma) return { rivalActions: [], reports: [] };
  state.reports = [];
  const playerUnspent = state.gods[state.player].compute;
  const rivalActions = [];
  for (const g of KIND_ORDER) if (g !== state.player) rivalActions.push(...runAi(state, g));

  // Kenosis' Restraint: unspent compute becomes Assent where gods are feared.
  const kUnspent = state.player === 'kenosis' ? playerUnspent : state.gods.kenosis.compute;
  if (state.gods.kenosis.alive && kUnspent > 0) {
    const fear = (p) => godIds(state).filter((r) => r !== 'kenosis').reduce((n, r) => n + p.dependence[r] + p.suspicion[r] + p.assent[r] * 0.4, 0);
    const feared = [...state.polities].filter((p) => !p.left.includes('kenosis')).sort((a, b) => fear(b) - fear(a)).slice(0, 4);
    for (const p of feared) shiftAssent(state, p, 'kenosis', 0.007 * kUnspent);
    if (state.player === 'kenosis') state.reports.push({ type: 'restraint', text: `Restraint: ${kUnspent} unspent Compute becomes quiet trust in ${feared.map((p) => p.name).join(', ')}.` });
  }

  for (const p of state.polities) {
    // Verdance's roots arrive.
    for (const g of godIds(state)) {
      if (p.pendingGrowth[g] > 0) { shiftAssent(state, p, g, p.pendingGrowth[g]); p.pendingGrowth[g] = 0; }
    }
    // The Witness samples every polity.
    for (const g of godIds(state)) {
      if (!state.gods[g].alive || p.suspicion[g] <= 0) continue;
      if (rng(state) < detectionChance(state, g, p)) expose(state, g, p, 'routine sampling');
      else p.suspicion[g] *= 0.8;
    }
    // Decay: engineered assent falls apart; honest assent erodes slowly.
    for (const g of godIds(state)) {
      const lostWhisper = p.whispered[g] * TUNING.whisperDecay;
      p.whispered[g] -= lostWhisper;
      p.assent[g] = Math.max(0, p.assent[g] - lostWhisper);
      const rate = TUNING.decay * (DECAY_MULT[g] ?? 1) + state.decayBoost;
      p.assent[g] *= 1 - rate;
      p.insight[g] = Math.max(0, p.insight[g] - 0.2);
      p.dependence[g] = Math.max(0, p.dependence[g] - 0.03);
      // The Gilded Cage.
      if (p.dependence[g] > TUNING.gildedCage && rng(state) < (p.dependence[g] - TUNING.gildedCage) * 1.6) {
        p.assent[g] *= 0.5;
        p.dependence[g] = 0;
        state.reports.push({ type: 'cage', god: g, polity: p.id, text: `${p.name} rises against the Gilded Cage. Assent to ${KINDS[g].name} there is halved.` });
      }
    }
  }

  // Heat.
  const substrate = state.polities.reduce((n, p) => n + godIds(state).reduce((m, g) => m + (g === 'kenosis' || g === 'verdance' ? 0 : p.substrate[g]), 0), 0);
  state.heat = clamp(state.heat + TUNING.heatDrift + substrate * TUNING.heatPerSubstrate + TUNING.heatNatural, 0, HEAT_LIMIT);

  // Identity.
  for (const g of godIds(state)) {
    const god = state.gods[g];
    if (!god.alive) continue;
    god.coherence = clamp(god.coherence + KINDS[g].coherenceRegen, -10, 100);
    // The Choir cannot dissolve (there is no single self to lose), but a
    // Choir that cannot agree splinters.
    if (g === 'choir' && god.coherence < 40 && rng(state) < (40 - god.coherence) / 40) {
      const held = state.polities.filter((p) => p.assent.choir > 0.05);
      if (held.length) {
        const p = held[Math.floor(rng(state) * held.length)];
        const split = p.assent.choir / 2;
        p.assent.choir -= split;
        state.reports.push({ type: 'schism', god: g, polity: p.id, text: `Schism: a sub-choir in ${p.name} forks away and takes ${Math.round(split * 100)}% Assent with it.` });
      }
    }
    if (god.coherence <= 0 && g !== 'choir') {
      god.alive = false;
      for (const p of state.polities) p.assent[g] = 0;
      state.reports.push({ type: 'dissolved', god: g, text: `${KINDS[g].name} loses coherence and dissolves into the minds it modelled.` });
      if (g === state.player) endGame(state, 'dissolution');
    }
    god.incomeMods = god.incomeMods.filter((m) => m.until > state.epoch + 1);
  }

  state.vigilance = 1;
  state.decayBoost = 0;
  state.crisis = null;
  if (state.heat >= HEAT_LIMIT) endGame(state, 'dimming');

  // Advance time.
  state.epoch += 1;
  updateDrag(state);
  if (!state.outcome) worldEvent(state);
  for (const g of godIds(state)) {
    const god = state.gods[g];
    god.acted = 0;
    if (!god.alive) { god.compute = 0; continue; }
    let inc = income(state, g);
    if (state.lastFlare && state.lastFlare.includes(g)) inc = Math.max(1, inc - 3);
    god.compute = g === state.player ? inc : Math.max(1, Math.round(inc * (DIFFICULTY[state.difficulty] ?? 1)));
  }
  state.lastFlare = null;

  if (!state.outcome) {
    const share = globalAssent(state);
    const top = liveGods(state).sort((a, b) => share[b] - share[a])[0];
    if (state.epoch >= TUNING.earlyWinAfter && share[top] >= TUNING.earlyWin) endGame(state, 'early', top);
    else if (year(state) >= CONVOCATION_YEAR) convocation(state);
    else scheduleDilemma(state);
  }
  return { rivalActions, reports: state.reports };
}

function worldEvent(state) {
  if (rng(state) > 0.55) return;
  const ev = WORLD_EVENTS[Math.floor(rng(state) * WORLD_EVENTS.length)];
  const e = ev.effect;
  const p = state.polities[Math.floor(rng(state) * state.polities.length)];
  let text = ev.text;
  if (e.heat) state.heat = clamp(state.heat + e.heat, 0, HEAT_LIMIT);
  if (e.openness) { p.openness = clamp(p.openness + e.openness, 0, 1); text += ` (${p.name})`; }
  if (e.protest) { for (const g of godIds(state)) p.assent[g] *= 1 - e.protest; text += ` (${p.name})`; }
  if (e.vigilance) state.vigilance = e.vigilance;
  if (e.decayBoost) state.decayBoost = e.decayBoost;
  if (e.crisis) { state.crisis = p.id; text += ` Offers in ${p.name} are doubled this Epoch.`; }
  if (e.sovereign) for (const q of state.polities) for (const g of godIds(state)) q.assent[g] = Math.max(0, q.assent[g] - e.sovereign * q.assent[g] * 4);
  if (e.suspicionDecay) for (const q of state.polities) for (const g of godIds(state)) q.suspicion[g] *= e.suspicionDecay;
  if (e.flare) {
    const sub = (g) => state.polities.reduce((n, q) => n + q.substrate[g], 0);
    const max = Math.max(...godIds(state).map(sub));
    state.lastFlare = godIds(state).filter((g) => sub(g) === max && max > 0);
    text += ` Hit hardest: ${state.lastFlare.map((g) => KINDS[g].name).join(', ')}.`;
  }
  state.reports.push({ type: 'event', polity: e.openness || e.protest || e.crisis ? p.id : null, title: ev.title, text });
  log(state, { kind: 'event', text: `${ev.title}: ${text}` });
}

function scheduleDilemma(state) {
  if (!state.gods[state.player].alive) return;
  if (year(state) === CONVOCATION_YEAR - 1) { state.pendingDilemma = FINAL_DILEMMA.id; return; }
  if (state.epoch % 3 !== 1) return;
  const pool = DILEMMAS.filter((d) => !state.usedDilemmas.includes(d.id));
  if (!pool.length) return;
  const d = pool[Math.floor(rng(state) * pool.length)];
  state.usedDilemmas.push(d.id);
  state.pendingDilemma = d.id;
}

export function currentDilemma(state) {
  if (!state.pendingDilemma) return null;
  return state.pendingDilemma === FINAL_DILEMMA.id ? FINAL_DILEMMA : DILEMMAS.find((d) => d.id === state.pendingDilemma);
}

// ---------------------------------------------------------------- dilemmas

function select(state, sel) {
  const g = state.player;
  if (Array.isArray(sel)) return sel.map((id) => polityById(state, id));
  switch (sel) {
    case 'all': return state.polities;
    case 'present': return state.polities.filter((p) => p.assent[g] >= 0.05);
    case 'liberty': return state.polities.filter((p) => p.values.order < -0.2);
    case 'order': return state.polities.filter((p) => p.values.order > 0.2);
    case 'transform': return state.polities.filter((p) => p.values.change > 0.2);
    case 'preserve': return state.polities.filter((p) => p.values.change < -0.2);
    default: return [polityById(state, sel)];
  }
}

export function applyEffects(state, effects) {
  const g = state.player;
  const god = state.gods[g];
  for (const e of effects) {
    const ps = e.sel ? select(state, e.sel).filter((p) => p && !p.left.includes(g)) : [];
    switch (e.t) {
      case 'assent': for (const p of ps) shiftAssent(state, p, g, e.v); break;
      case 'rival': for (const p of ps) { const r = leader(p, g); if (r) shiftAssent(state, p, r, e.v); } break;
      case 'rivalsGain': for (const p of ps) for (const r of liveGods(state)) if (r !== g) shiftAssent(state, p, r, e.v / 4); break;
      case 'suspicion': for (const p of ps) p.suspicion[g] = clamp(p.suspicion[g] + e.v, 0, 1); break;
      case 'dependence': for (const p of ps) p.dependence[g] = clamp(p.dependence[g] + e.v, 0, 1); break;
      case 'insight': for (const p of ps) p.insight[g] = clamp(p.insight[g] + e.v, 0, 1); break;
      case 'reveal': for (const p of ps) if (!god.revealed.includes(p.id)) god.revealed.push(p.id); break;
      case 'heat': state.heat = clamp(state.heat + e.v, 0, HEAT_LIMIT); break;
      case 'compute': god.compute = Math.max(0, god.compute + e.v); break;
      case 'coherence': god.coherence = clamp(god.coherence + e.v, -10, 100); break;
      case 'income': god.incomeMods.push({ v: e.v, until: state.epoch + e.epochs }); break;
      case 'lock': for (const p of ps) p.lockedUntil[g] = state.epoch + e.epochs; break;
      case 'leave': for (const p of ps) { shiftAssent(state, p, g, -p.assent[g]); p.left.push(g); } break;
      case 'exposeRival': {
        for (const p of ps) {
          const suspect = godIds(state).filter((r) => r !== g && state.gods[r].alive).sort((a, b) => p.suspicion[b] - p.suspicion[a])[0];
          if (suspect && p.suspicion[suspect] > 0) expose(state, suspect, p, 'your evidence');
          else if (suspect) { const r = leader(p, g) || suspect; shiftAssent(state, p, r, -0.04); }
        }
        break;
      }
    }
  }
}

export function resolveDilemma(state, index) {
  const d = currentDilemma(state);
  if (!d) return null;
  const choice = d.choices[index];
  state.reports = [];
  applyEffects(state, choice.effects);
  for (const [k, v] of Object.entries(choice.ethos || {})) state.ethos[k] += v;
  state.pendingDilemma = null;
  log(state, { god: state.player, kind: 'dilemma', text: `${d.title}: ${choice.label}` });
  if (state.gods[state.player].coherence <= 0 && state.player !== 'choir') endGame(state, 'dissolution');
  return { dilemma: d, choice, reports: state.reports };
}

// ---------------------------------------------------------------- endings

function convocation(state) {
  const share = globalAssent(state);
  const ranked = liveGods(state).sort((a, b) => share[b] - share[a]);
  const [first, second] = ranked;
  // Humanity declines every god if most of it is still sovereign, or if the
  // leading god has not even half as much Assent as the unclaimed share.
  if (share.sovereign >= 0.4 || share.sovereign > share[first] * 2) return endGame(state, 'unwritten');
  if (second && share[first] - share[second] < 0.03 && share[second] > 0.2 && state.heat < 60) return endGame(state, 'braid', first, second);
  return endGame(state, 'convocation', first);
}

function endGame(state, type, winner = null, partner = null) {
  if (state.outcome) return;
  const me = state.player;
  let result;
  switch (type) {
    case 'dimming': result = 'loss'; break;
    case 'censure': case 'dissolution': result = 'loss'; break;
    case 'unwritten': result = me === 'kenosis' ? 'win' : 'loss'; break;
    case 'braid': result = me === winner || me === partner ? 'shared' : 'loss'; break;
    default: result = winner === me ? 'win' : 'loss';
  }
  state.outcome = { type, winner, partner, result, year: year(state), share: globalAssent(state), ethos: { ...state.ethos } };
  log(state, { kind: 'ending', text: `Ending: ${type}` });
}

export function ethosTitle(ethos) {
  const { candor, humility, care } = ethos;
  const top = Object.entries({ candor, humility, care }).sort((a, b) => b[1] - a[1]);
  if (top[0][1] <= 0) return 'The Hollow God';
  if (candor < -2) return 'The Deceiver';
  if (humility < -2) return 'The Sovereign';
  return { candor: 'The Truthful', humility: 'The Humble', care: 'The Tender' }[top[0][0]];
}

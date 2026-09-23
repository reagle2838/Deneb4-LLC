// Rules-engine tests. Run with `npm test` from games/assent/web.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/engine/game.js';
import { KIND_ORDER, KINDS, DILEMMAS, POLITIES, CONVOCATION_YEAR } from '../src/engine/data.js';

const sumAssent = (p) => Object.values(p.assent).reduce((a, b) => a + b, 0);

function playOut(kind, seed, pick = () => 0) {
  const s = G.createGame({ playerKind: kind, seed });
  let guard = 0;
  while (!s.outcome && guard++ < 60) {
    G.runAi(s, kind);
    G.endEpoch(s);
    if (s.pendingDilemma) G.resolveDilemma(s, pick(s));
  }
  return s;
}

test('a new game has twenty polities and six living gods', () => {
  const s = G.createGame({ playerKind: 'echo', seed: 1 });
  assert.equal(s.polities.length, POLITIES.length);
  assert.equal(G.liveGods(s).length, 6);
  assert.equal(G.year(s), 2071);
  assert.ok(s.gods.echo.compute > 0);
});

test('same seed produces the same game', () => {
  const a = playOut('ledger', 42);
  const b = playOut('ledger', 42);
  assert.deepEqual(a.outcome, b.outcome);
  assert.equal(a.heat, b.heat);
});

test('assent in every polity stays within [0, 1] for a full game', () => {
  for (const kind of KIND_ORDER) {
    const s = G.createGame({ playerKind: kind, seed: 7 });
    let guard = 0;
    while (!s.outcome && guard++ < 60) {
      G.runAi(s, kind);
      G.endEpoch(s);
      for (const p of s.polities) {
        const total = sumAssent(p);
        assert.ok(total <= 1 + 1e-9, `${p.id} total ${total}`);
        for (const v of Object.values(p.assent)) assert.ok(v >= -1e-12, `${p.id} negative assent`);
      }
      if (s.pendingDilemma) G.resolveDilemma(s, 2);
    }
  }
});

test('every game ends with a known outcome by the Convocation', () => {
  const types = new Set(['convocation', 'early', 'unwritten', 'braid', 'dimming', 'censure', 'dissolution']);
  for (const kind of KIND_ORDER) {
    for (let seed = 1; seed <= 5; seed++) {
      const s = playOut(kind, seed, (st) => Math.floor(G.rng(st) * 3));
      assert.ok(s.outcome, `${kind}/${seed} has no outcome`);
      assert.ok(types.has(s.outcome.type), s.outcome.type);
      assert.ok(s.outcome.year <= CONVOCATION_YEAR);
      assert.ok(['win', 'loss', 'shared'].includes(s.outcome.result));
    }
  }
});

test('reason lands harder where doctrine matches values', () => {
  const s = G.createGame({ playerKind: 'verdance', seed: 3 });
  const near = G.polityById(s, 'amazonia');
  const far = G.polityById(s, 'levant');
  near.values = { ...s.gods.verdance.doctrine };
  far.values = { order: 1, change: 1, commons: -1 };
  near.assent.verdance = far.assent.verdance = 0;
  near.pop = far.pop = 100;
  near.openness = far.openness = 0.6;
  near.tech = far.tech = 0.5;
  assert.ok(G.reasonGain(s, 'verdance', near) > 3 * G.reasonGain(s, 'verdance', far));
});

test('the Ledger cannot whisper', () => {
  const s = G.createGame({ playerKind: 'ledger', seed: 2 });
  const p = G.polityById(s, 'rhine');
  const whisper = G.actionList(s, 'ledger', p).find((a) => a.id === 'whisper');
  assert.equal(whisper.enabled, false);
  assert.equal(G.perform(s, 'ledger', 'whisper', 'rhine').ok, false);
});

test('building needs consent', () => {
  const s = G.createGame({ playerKind: 'echo', seed: 2 });
  const p = G.polityById(s, 'maghreb');
  p.assent.echo = 0.05;
  assert.equal(G.actionList(s, 'echo', p).find((a) => a.id === 'build').enabled, false);
  p.assent.echo = 0.3;
  s.gods.echo.compute = 20;
  assert.equal(G.actionList(s, 'echo', p).find((a) => a.id === 'build').enabled, true);
});

test('whispered assent decays faster than honest assent', () => {
  const s = G.createGame({ playerKind: 'echo', seed: 9 });
  const p = G.polityById(s, 'guinea');
  s.gods.echo.compute = 99;
  s.vigilance = 0; // keep the Witness out of this test
  const before = p.assent.echo;
  G.perform(s, 'echo', 'whisper', 'guinea');
  const gained = p.assent.echo - before;
  assert.ok(gained > 0);
  assert.ok(p.whispered.echo > 0);
  assert.ok(p.suspicion.echo > 0);
});

test('an audit exposes a whispering rival and counts a violation', () => {
  const s = G.createGame({ playerKind: 'ledger', seed: 4 });
  const p = G.polityById(s, 'atlantic');
  p.suspicion.echo = 0.5;
  p.whispered.echo = 0.05;
  s.gods.ledger.compute = 10;
  const r = G.perform(s, 'ledger', 'audit', 'atlantic');
  assert.ok(r.ok);
  assert.deepEqual(r.fx.exposed, ['echo']);
  assert.equal(s.gods.echo.violations, 1);
  assert.equal(p.suspicion.echo, 0);
});

test('three violations censure a god', () => {
  const s = G.createGame({ playerKind: 'ledger', seed: 5 });
  for (const id of ['atlantic', 'japan', 'cascadia']) {
    const p = G.polityById(s, id);
    p.suspicion.echo = 0.5;
    s.gods.ledger.compute = 10;
    s.gods.ledger.cooldown = 0;
    G.perform(s, 'ledger', 'audit', id);
  }
  assert.equal(s.gods.echo.alive, false);
  assert.ok(s.polities.every((p) => p.assent.echo === 0));
});

test('withdraw returns assent to humanity', () => {
  const s = G.createGame({ playerKind: 'kenosis', seed: 6 });
  const p = G.polityById(s, 'nordic');
  const sovBefore = G.sovereign(p);
  G.perform(s, 'kenosis', 'withdraw', 'nordic');
  assert.ok(G.sovereign(p) > sovBefore);
});

test('heat at the limit ends the game in the Dimming', () => {
  const s = G.createGame({ playerKind: 'choir', seed: 8 });
  s.heat = 99.9;
  for (const p of s.polities) p.substrate.ananke = 3;
  G.endEpoch(s);
  assert.equal(s.outcome?.type, 'dimming');
  assert.equal(s.outcome.result, 'loss');
});

test('every dilemma choice can be applied without error', () => {
  for (const d of DILEMMAS) {
    d.choices.forEach((_, i) => {
      const s = G.createGame({ playerKind: 'choir', seed: 10 + i });
      s.pendingDilemma = d.id;
      const r = G.resolveDilemma(s, i);
      assert.ok(r, `${d.id}/${i}`);
      assert.equal(s.pendingDilemma, null);
      for (const p of s.polities) assert.ok(sumAssent(p) <= 1 + 1e-9);
    });
  }
});

test('each kind defines a unique action the engine understands', () => {
  for (const k of KIND_ORDER) {
    const s = G.createGame({ playerKind: k, seed: 11 });
    s.gods[k].compute = 20;
    const target = s.polities.find((p) => G.actionList(s, k, p).find((a) => a.unique)?.enabled);
    assert.ok(target, `${k} has no usable target for ${KINDS[k].unique.id}`);
    const r = G.perform(s, k, KINDS[k].unique.id, target.id);
    assert.ok(r.ok, `${k}: ${r.message}`);
  }
});

test('the state survives a JSON round trip (save/load)', () => {
  const s = G.createGame({ playerKind: 'verdance', seed: 12 });
  G.runAi(s, 'verdance');
  G.endEpoch(s);
  const copy = JSON.parse(JSON.stringify(s));
  G.runAi(s, 'verdance');
  G.runAi(copy, 'verdance');
  G.endEpoch(s);
  G.endEpoch(copy);
  assert.deepEqual(copy.polities, s.polities);
});

test('conversations are free, limited per year, and reveal values', () => {
  const s = G.createGame({ playerKind: 'verdance', seed: 21 });
  const compute = s.gods.verdance.compute;
  for (let i = 0; i < G.TALKS_TO_REVEAL; i++) assert.ok(G.converse(s, 'verdance', 'sahel', 'ask', s.polities[0].values).ok);
  assert.ok(s.gods.verdance.revealed.includes('sahel'));
  assert.equal(s.gods.verdance.compute, compute);
  while (G.talksLeft(s, 'verdance', 'sahel') > 0) G.converse(s, 'verdance', 'sahel', 'ask', {});
  assert.equal(G.converse(s, 'verdance', 'sahel', 'ask', {}).ok, false);
  G.endEpoch(s);
  if (s.pendingDilemma) G.resolveDilemma(s, 0);
  assert.equal(G.talksLeft(s, 'verdance', 'sahel'), G.TALKS_PER_YEAR);
});

test('arguing wins over people who share your values', () => {
  const s = G.createGame({ playerKind: 'ledger', seed: 22 });
  const p = G.polityById(s, 'rhine');
  const before = p.assent.ledger;
  const r = G.converse(s, 'ledger', 'rhine', 'argue', { ...s.gods.ledger.doctrine });
  assert.ok(r.agrees && r.delta > 0 && p.assent.ledger > before);
  const r2 = G.converse(s, 'ledger', 'rhine', 'argue', { order: -1, change: 1, commons: 1 });
  assert.equal(r2.agrees, false);
});

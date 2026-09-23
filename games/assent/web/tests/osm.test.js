// OpenStreetMap conversion and rasterisation tests (no network needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertOverpass, projector, buildingHeight, assembleRings, overpassQuery, SPOTS } from '../src/osm/convert.js';
import { waterGrid, Grid } from '../src/osm/raster.js';
import { syntheticOverpass } from './fixtures/synthetic-city.js';
import { POLITIES } from '../src/engine/data.js';

const spot = { lat: 35.6595, lon: 139.7005, name: 'Test' };

test('every polity has a real place to visit', () => {
  for (const p of POLITIES) {
    assert.ok(SPOTS[p.id], p.id);
    assert.ok(overpassQuery(SPOTS[p.id]).includes('building'));
  }
});

test('projection is metric: 0.001° north is ~110 m in -z', () => {
  const P = projector(spot);
  const [x, z] = P(spot.lat + 0.001, spot.lon);
  assert.ok(Math.abs(x) < 0.01);
  assert.ok(Math.abs(z + 110.5) < 1);
});

test('building heights come from tags, then levels, then type', () => {
  assert.equal(buildingHeight({ building: 'yes', height: '42 m' }, 1), 42);
  assert.equal(buildingHeight({ building: 'yes', 'building:levels': '10' }, 1), 33);
  const house = buildingHeight({ building: 'house' }, 3);
  assert.ok(house >= 4 && house <= 8);
});

test('multipolygon fragments join into closed rings', () => {
  const rings = assembleRings([[[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]]]);
  assert.equal(rings.length, 1);
  assert.deepEqual(rings[0][0], rings[0][rings[0].length - 1]);
});

test('a synthetic city converts to buildings, roads, water and trees', () => {
  const data = convertOverpass(syntheticOverpass(spot), spot);
  assert.ok(data.buildings.length > 200, `buildings ${data.buildings.length}`);
  assert.ok(data.roads.length >= 26);
  assert.equal(data.water.length, 1); // the lake relation
  assert.equal(data.coast.length, 1);
  assert.equal(data.rivers.length, 1);
  assert.equal(data.green.length, 1);
  assert.equal(data.trees.length, 80);
  assert.ok(data.buildings.every((b) => b[0] > 1 && b.length >= 8));
  assert.ok(JSON.stringify(data).length < 400_000);
});

test('water grid: sea east of the coastline, lake and river are water, city is land', () => {
  const data = convertOverpass(syntheticOverpass(spot), spot);
  const w = waterGrid(data, 680, 3);
  assert.equal(w.get(600, 0), 1, 'open sea');
  assert.equal(w.get(0, 0), 0, 'city centre');
  assert.equal(w.get(-300, -300), 1, 'lake');
  assert.equal(w.get(120, 0), 1, 'river');
  assert.equal(w.get(-200, 250), 0, 'land west of the coast');
});

test('grid polygon fill and flood fill', () => {
  const g = new Grid(50, 1, Uint8Array);
  g.fillPolygon([-10, -10, 10, -10, 10, 10, -10, 10], 1);
  assert.equal(g.get(0, 0), 1);
  assert.equal(g.get(20, 0), 0);
  const barrier = new Grid(50, 1, Uint8Array);
  barrier.strokeLine([0, -50, 0, 50], 2, 1);
  const f = new Grid(50, 1, Uint8Array);
  f.flood([[20, 0]], barrier, 1);
  assert.equal(f.get(30, 0), 1);
  assert.equal(f.get(-30, 0), 0);
});

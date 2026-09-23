// Download real OpenStreetMap data for every polity's ground-level scene
// and save it to public/assets/osm/<id>.json, so the game works offline
// and loads instantly. Run from games/assent/web:
//
//   npm run fetch-osm              # all twenty places
//   npm run fetch-osm -- japan     # just one (or several)
//   npm run fetch-osm -- --force   # re-download ones you already have
//
// Map data © OpenStreetMap contributors (ODbL). Please keep the attribution.
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS, overpassQuery, convertOverpass } from '../src/osm/convert.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'assets', 'osm');
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const args = process.argv.slice(2);
const force = args.includes('--force');
const ids = args.filter((a) => !a.startsWith('--'));
const todo = ids.length ? ids : Object.keys(SPOTS);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(spot) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ASSENT-game/1.0 (fetch-osm)' },
          body: `data=${encodeURIComponent(overpassQuery(spot))}`,
        });
        if (res.status === 429 || res.status === 504) { lastErr = new Error(`${url}: busy (${res.status})`); continue; }
        if (!res.ok) { lastErr = new Error(`${url}: HTTP ${res.status}`); continue; }
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    await sleep(5000 * (attempt + 1));
  }
  throw lastErr;
}

await mkdir(outDir, { recursive: true });
let ok = 0;
for (const id of todo) {
  const spot = SPOTS[id];
  if (!spot) { console.log(`✗ ${id}: unknown polity`); continue; }
  const file = join(outDir, `${id}.json`);
  if (!force) {
    try { await access(file); console.log(`• ${id}: already downloaded (use --force to refresh)`); ok++; continue; } catch { /* fetch it */ }
  }
  process.stdout.write(`… ${id}: ${spot.name} `);
  try {
    const data = convertOverpass(await query(spot), spot);
    data.fetched = new Date().toISOString().slice(0, 10);
    await writeFile(file, JSON.stringify(data));
    const c = data.counts;
    console.log(`✓ ${c.buildings} buildings, ${c.roads} roads, ${c.water + c.coast} water features, ${c.green} green areas, ${c.trees} trees`);
    ok++;
  } catch (e) {
    console.log(`✗ ${e.message}`);
  }
  await sleep(1500); // be polite to the public Overpass servers
}
console.log(`\n${ok}/${todo.length} places ready in ${outDir}`);

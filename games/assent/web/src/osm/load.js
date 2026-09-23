// Finds real map data for a polity, in order of preference:
//   1. a pre-baked file in assets/osm/ (from `npm run fetch-osm`)
//   2. this browser's cache (IndexedDB) from an earlier visit
//   3. a live Overpass API request, which is then cached
// Returns null if none of those work, and the game falls back to its
// procedurally generated place.
import { SPOTS, overpassQuery, convertOverpass, OSM_VERSION } from './convert.js';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const DB = 'assent-osm';

function idb() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('places');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function cacheGet(id) {
  const db = await idb();
  if (!db) return null;
  return new Promise((resolve) => {
    const r = db.transaction('places').objectStore('places').get(id);
    r.onsuccess = () => resolve(r.result?.v === OSM_VERSION ? r.result : null);
    r.onerror = () => resolve(null);
  });
}

async function cachePut(id, data) {
  const db = await idb();
  if (!db) return;
  try { db.transaction('places', 'readwrite').objectStore('places').put(data, id); } catch { /* quota */ }
}

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function loadOsm(id, { base = '', live = true, onStatus = () => {} } = {}) {
  const spot = SPOTS[id];
  if (!spot) return null;
  try {
    const res = await fetchWithTimeout(`${base}assets/osm/${id}.json`, {}, 8000);
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const data = await res.json();
      if (data?.v === OSM_VERSION) return data;
    }
  } catch { /* not pre-baked */ }
  const cached = await cacheGet(id);
  if (cached) return cached;
  if (!live) return null;
  onStatus(`Mapping ${spot.name} from OpenStreetMap…`);
  for (const url of ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery(spot))}`,
      }, 30000);
      if (!res.ok) continue;
      const data = convertOverpass(await res.json(), spot);
      if (!data.buildings.length && !data.roads.length) return null;
      await cachePut(id, data);
      return data;
    } catch { /* try the next mirror */ }
  }
  return null;
}

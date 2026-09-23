// OpenStreetMap → compact local map data for a ground-level scene.
// Pure JS: used by the browser loader and by scripts/fetch-osm.mjs.
//
// Map data © OpenStreetMap contributors, available under the Open Database
// License (ODbL). The game shows this attribution whenever OSM data is used.

export const OSM_VERSION = 1;
export const OSM_RADIUS = 600; // metres around the spot
export const ATTRIBUTION = 'Map data © OpenStreetMap contributors (ODbL)';

// A real, recognisable place in each polity.
export const SPOTS = {
  cascadia: { lat: 49.2847, lon: -123.1117, name: 'Downtown Vancouver' },
  sunbelt: { lat: 29.7589, lon: -95.3677, name: 'Downtown Houston' },
  atlantic: { lat: 40.758, lon: -73.9855, name: 'Times Square, New York' },
  andean: { lat: -12.0464, lon: -77.0300, name: 'Plaza de Armas, Lima' },
  amazonia: { lat: -3.1302, lon: -60.0234, name: 'Teatro Amazonas, Manaus' },
  southcone: { lat: -34.6083, lon: -58.3712, name: 'Plaza de Mayo, Buenos Aires' },
  nordic: { lat: 59.9114, lon: 10.7337, name: 'Rådhusplassen, Oslo' },
  rhine: { lat: 50.1106, lon: 8.6821, name: 'Römerberg, Frankfurt' },
  maghreb: { lat: 31.6258, lon: -7.9891, name: 'Jemaa el-Fnaa, Marrakesh' },
  sahel: { lat: 13.5170, lon: 2.1098, name: 'Grand Marché, Niamey' },
  guinea: { lat: 6.4541, lon: 3.3947, name: 'Lagos Island' },
  greatlakes: { lat: -1.2841, lon: 36.8233, name: 'Kenyatta Avenue, Nairobi' },
  levant: { lat: 25.1972, lon: 55.2744, name: 'Downtown Dubai' },
  indus: { lat: 28.6315, lon: 77.2167, name: 'Connaught Place, Delhi' },
  bengal: { lat: 23.7330, lon: 90.4172, name: 'Motijheel, Dhaka' },
  siberia: { lat: 55.0302, lon: 82.9204, name: 'Lenin Square, Novosibirsk' },
  pacific: { lat: 31.2397, lon: 121.4900, name: 'The Bund, Shanghai' },
  archipelago: { lat: -6.1951, lon: 106.8231, name: 'Bundaran HI, Jakarta' },
  japan: { lat: 35.6595, lon: 139.7005, name: 'Shibuya Crossing, Tokyo' },
  southcross: { lat: -33.8611, lon: 151.2108, name: 'Circular Quay, Sydney' },
};

export function overpassQuery({ lat, lon }, radius = OSM_RADIUS) {
  const a = `(around:${radius},${lat},${lon})`;
  return `[out:json][timeout:90];
(
  way["building"]${a};
  relation["building"]${a};
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|service|footway|path|cycleway|steps)$"]${a};
  way["natural"="water"]${a};
  relation["natural"="water"]${a};
  way["waterway"~"^(riverbank|river|canal|dock)$"]${a};
  way["natural"="coastline"]${a};
  way["leisure"~"^(park|garden|pitch|playground)$"]${a};
  way["landuse"~"^(grass|forest|meadow|recreation_ground|village_green|cemetery)$"]${a};
  way["natural"~"^(wood|scrub|beach|sand|grassland)$"]${a};
  node["natural"="tree"]${a};
);
out geom;`;
}

// Equirectangular projection around the spot: +x east, -z north, metres.
export function projector({ lat, lon }) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const kz = 110540;
  return (la, lo) => [Math.round((lo - lon) * kx * 10) / 10, Math.round(-(la - lat) * kz * 10) / 10];
}

const ROAD_WIDTH = {
  motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 9, residential: 7, unclassified: 7,
  living_street: 6, pedestrian: 7, service: 4.5, footway: 2.6, path: 2.2, cycleway: 2.4, steps: 2.4,
};
const FOOT = new Set(['pedestrian', 'footway', 'path', 'cycleway', 'steps', 'living_street']);

function num(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Height in metres from OSM tags, or a plausible default by building type.
export function buildingHeight(tags, seed) {
  const r = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const h = num(tags.height);
  if (h && h > 1 && h < 900) return h;
  const levels = num(tags['building:levels']);
  if (levels && levels > 0 && levels < 200) return levels * 3.2 + (num(tags['roof:levels']) ?? 0) * 2 + 1;
  switch (tags.building) {
    case 'house': case 'detached': case 'semidetached_house': case 'terrace': case 'bungalow': case 'hut': case 'shed': case 'garage': case 'garages':
      return 4 + r * 4;
    case 'apartments': case 'residential': return 12 + r * 18;
    case 'office': case 'commercial': return 14 + r * 30;
    case 'retail': case 'supermarket': return 6 + r * 6;
    case 'church': case 'cathedral': case 'mosque': case 'temple': return 18 + r * 12;
    case 'industrial': case 'warehouse': return 7 + r * 5;
    default: return 7 + r * 12;
  }
}

function buildingKind(tags, h) {
  if (['church', 'cathedral', 'mosque', 'temple', 'shrine', 'chapel'].includes(tags.building) || tags.amenity === 'place_of_worship') return 3;
  if (h > 40 || ['office', 'commercial'].includes(tags.building)) return 1;
  if (['house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'hut'].includes(tags.building)) return 2;
  return 0;
}

// Join way fragments (multipolygon members) into closed rings.
export function assembleRings(lines) {
  const rings = [];
  const pending = lines.filter((l) => l.length >= 2).map((l) => l.slice());
  const key = (p) => `${p[0]},${p[1]}`;
  while (pending.length) {
    let ring = pending.shift();
    let guard = 0;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && guard++ < 1000) {
      const end = key(ring[ring.length - 1]);
      const i = pending.findIndex((l) => key(l[0]) === end || key(l[l.length - 1]) === end);
      if (i < 0) break;
      let next = pending.splice(i, 1)[0];
      if (key(next[0]) !== end) next = next.reverse();
      ring = ring.concat(next.slice(1));
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

const flat = (pts) => pts.flat();

// Overpass JSON → { buildings, roads, water, coast, rivers, green, trees }.
export function convertOverpass(json, spot, { radius = OSM_RADIUS, maxBuildings = 6000 } = {}) {
  const P = projector(spot);
  const geomOf = (el) => (el.geometry || []).map((g) => P(g.lat, g.lon));
  const out = {
    v: OSM_VERSION, center: [spot.lat, spot.lon], name: spot.name, radius, attribution: ATTRIBUTION,
    buildings: [], roads: [], water: [], holes: [], coast: [], rivers: [], green: [], trees: [],
  };
  const within = (pts) => pts.some(([x, z]) => Math.hypot(x, z) < radius * 1.3);
  for (const el of json.elements || []) {
    const t = el.tags || {};
    if (el.type === 'node') {
      if (t.natural === 'tree') {
        const [x, z] = P(el.lat, el.lon);
        out.trees.push(x, z);
      }
      continue;
    }
    // Rings: plain closed ways, or the members of a multipolygon relation.
    let outers = [], inners = [];
    if (el.type === 'way') {
      const g = geomOf(el);
      if (g.length < 2 || !within(g)) continue;
      if (t.highway) {
        out.roads.push([ROAD_WIDTH[t.highway] ?? 5, FOOT.has(t.highway) ? 1 : 0, ...flat(g)]);
        continue;
      }
      if (t.natural === 'coastline') { out.coast.push(flat(g)); continue; }
      if (t.waterway && t.waterway !== 'riverbank' && t.waterway !== 'dock') {
        out.rivers.push([t.waterway === 'river' ? 24 : 10, ...flat(g)]);
        continue;
      }
      outers = [g];
    } else if (el.type === 'relation') {
      const members = el.members || [];
      outers = assembleRings(members.filter((m) => m.role !== 'inner' && m.geometry).map((m) => m.geometry.map((g) => P(g.lat, g.lon))));
      inners = assembleRings(members.filter((m) => m.role === 'inner' && m.geometry).map((m) => m.geometry.map((g) => P(g.lat, g.lon))));
      if (!outers.some(within)) continue;
    } else continue;

    for (const ring of outers) {
      if (ring.length < 4) continue;
      if (t.building) {
        const h = buildingHeight(t, el.id % 9973);
        out.buildings.push([Math.round(h * 10) / 10, buildingKind(t, h), ...flat(ring)]);
      } else if (t.natural === 'water' || t.waterway === 'riverbank' || t.waterway === 'dock') {
        out.water.push(flat(ring));
      } else {
        const kind = t.natural === 'beach' || t.natural === 'sand' ? 'sand' : t.landuse === 'forest' || t.natural === 'wood' ? 'wood' : 'grass';
        out.green.push([kind, ...flat(ring)]);
      }
    }
    for (const ring of inners) if (t.natural === 'water') out.holes.push(flat(ring));
  }
  // Keep the buildings nearest the spot if a city is extremely dense.
  if (out.buildings.length > maxBuildings) {
    const d = (b) => Math.hypot(b[2], b[3]);
    out.buildings.sort((a, b) => d(a) - d(b));
    out.buildings.length = maxBuildings;
  }
  out.counts = { buildings: out.buildings.length, roads: out.roads.length, water: out.water.length, coast: out.coast.length, green: out.green.length, trees: out.trees.length / 2 };
  return out;
}

// A synthetic Overpass API response shaped like real OpenStreetMap data:
// a tilted street grid with buildings (some tagged with heights or levels),
// a park, a river, a lake split across two relation members, trees, and a
// coastline to the east (water on the right of the way's direction).
export function syntheticOverpass(center = { lat: 35.6595, lon: 139.7005 }) {
  const kx = 111320 * Math.cos((center.lat * Math.PI) / 180), kz = 110540;
  const ll = (x, z) => ({ lat: center.lat - z / kz, lon: center.lon + x / kx });
  const rot = (x, z, a = 0.35) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
  const els = [];
  let id = 1;
  const way = (pts, tags) => els.push({ type: 'way', id: id++, tags, geometry: pts.map(([x, z]) => ll(x, z)) });
  const block = 70;
  for (let k = -6; k <= 6; k++) {
    way([rot(-450, k * block), rot(450, k * block)], { highway: k % 3 === 0 ? 'primary' : 'residential' });
    way([rot(k * block, -450), rot(k * block, 450)], { highway: k % 4 === 0 ? 'secondary' : 'residential' });
  }
  way([rot(-20, -20), rot(20, -20), rot(20, 20), rot(-20, 20), rot(-20, -20)], { highway: 'pedestrian', area: 'yes' });
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = -6; i < 6; i++) for (let j = -6; j < 6; j++) {
    if (i === 1 && j === 1) continue; // the park
    const cx = (i + 0.5) * block, cz = (j + 0.5) * block;
    if (Math.hypot(cx, cz) > 520 || (cx > 90 && cx < 160)) continue; // river gap
    for (let b = 0; b < 4; b++) {
      const bx = cx + (b % 2 ? 14 : -14), bz = cz + (b < 2 ? -14 : 14);
      const w = 8 + r() * 12, d = 8 + r() * 12;
      const tags = { building: r() < 0.3 ? 'office' : r() < 0.5 ? 'apartments' : 'yes' };
      if (r() < 0.4) tags['building:levels'] = String(Math.floor(3 + r() * 40));
      if (r() < 0.1) tags.height = `${(60 + r() * 150).toFixed(0)} m`;
      way([rot(bx - w / 2, bz - d / 2), rot(bx + w / 2, bz - d / 2), rot(bx + w / 2, bz + d / 2 - 3), rot(bx + w / 2 - 4, bz + d / 2), rot(bx - w / 2, bz + d / 2), rot(bx - w / 2, bz - d / 2)], tags);
    }
  }
  way([rot(70, 70), rot(140, 70), rot(140, 140), rot(70, 140), rot(70, 70)], { leisure: 'park' });
  way([rot(125, -600), rot(120, 0), rot(128, 600)], { waterway: 'river' });
  // Lake as a multipolygon whose outer ring is split across two ways.
  const lake = [];
  for (let a = 0; a <= 16; a++) lake.push(ll(-300 + Math.cos((a / 16) * Math.PI * 2) * 60, -300 + Math.sin((a / 16) * Math.PI * 2) * 40));
  els.push({ type: 'relation', id: id++, tags: { natural: 'water', type: 'multipolygon' }, members: [
    { type: 'way', role: 'outer', geometry: lake.slice(0, 9) },
    { type: 'way', role: 'outer', geometry: lake.slice(8) },
  ] });
  // Coastline running south → north at x ≈ 470: land on the left (west), sea on the right (east).
  way([[470, 700], [460, 300], [480, 0], [465, -300], [470, -700]], { natural: 'coastline' });
  for (let t = 0; t < 40; t++) {
    const p = ll(70 + r() * 70, 70 + r() * 70);
    els.push({ type: 'node', id: id++, lat: p.lat, lon: p.lon, tags: { natural: 'tree' } });
  }
  return { version: 0.6, elements: els };
}

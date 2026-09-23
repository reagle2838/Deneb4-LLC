// A polity's ground scene built from real OpenStreetMap data: the actual
// streets, building footprints and heights, parks, rivers and coastline
// around a recognisable spot, dressed for 2071 (lit windows, the Gods'
// datacenters, people). Beyond the mapped area the generated landscape
// and a procedural skyline continue to the horizon.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, seeded, hashString, smoothstep } from './noise.js';
import { place } from './places.js';
import { facadeMaterial, STYLES, detailTexture, waterNormals, addTrees, datacenter } from './env.js';
import { Grid, waterGrid } from '../osm/raster.js';

const WORLD = 2600;

export function buildOsmEnvironment(polity, state, { night = 0, low = false }, osm) {
  const P = place(polity.id);
  const rand = seeded(hashString(polity.id) ^ 0x05e1);
  const seed = hashString(polity.id) % 1000;
  const R = osm.radius;
  const EXT = R + 80;
  const group = new THREE.Group();
  const obstacles = [];
  const nightHooks = [];
  const clampE = (v) => Math.max(-EXT + 2, Math.min(EXT - 2, v));

  // ---- rasters: water, green areas, roads, building tops
  const water = waterGrid(osm, EXT, 3);
  water.blur(2);
  const green = new Grid(EXT, 3, Uint8Array);
  const GREEN_KIND = { grass: 1, wood: 2, sand: 3 };
  for (const g of osm.green) green.fillPolygon(g, GREEN_KIND[g[0]] ?? 1, 'set', 1);
  const roadMask = new Grid(EXT, 3, Uint8Array);
  for (const r of osm.roads) roadMask.strokeLine(r, r[0], r[1] ? 2 : 1, 2);
  const tops = new Grid(EXT, 2, Float32Array);

  const waterAt = (x, z) => water.sample(clampE(x), clampE(z));
  const heightAt = (x, z) => {
    const r = Math.hypot(x, z);
    let h = (fbm(x * 0.004, z * 0.004, seed, 4) - 0.5) * P.hills * (0.06 + smoothstep(R, R + 500, r) * 0.9);
    h += smoothstep(R + 350, R + 900, r) * P.mountains * fbm(x * 0.002 + 5, z * 0.002 + 5, seed + 3, 5) * 1.6;
    h += smoothstep(R + 250, R + 800, r) * 25;
    h = Math.max(h, 0) + 1.2;
    const w = waterAt(x, z);
    return w > 0 ? h * (1 - w) - 5 * w : h;
  };
  const isWater = (x, z) => waterAt(x, z) > 0.5;
  const hasWater = water.data.some((v) => v > 0.5);

  // ---- terrain
  const segs = low ? 300 : 460;
  const terrainGeo = new THREE.PlaneGeometry(WORLD, WORLD, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const pal = P.palette;
  const PAVED = [0.47, 0.46, 0.43], GRASS = [0.3, 0.42, 0.18], WOOD = [0.19, 0.3, 0.13], SAND = [0.8, 0.7, 0.52], SHORE = [0.52, 0.48, 0.4];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const r = Math.hypot(x, z);
    const n = fbm(x * 0.03, z * 0.03, seed + 7, 3);
    let c;
    const g = r < EXT ? green.get(x, z) : 0;
    if (g === 1) c = GRASS;
    else if (g === 2) c = WOOD;
    else if (g === 3) c = SAND;
    else if (r < R + 40) c = PAVED;
    else {
      const t = smoothstep(0, 60, h) * 0.6 + n * 0.4;
      c = pal.low.map((v, k) => v + (pal.high[k] - v) * t);
      c = c.map((v, k) => v + (pal.rock[k] - v) * smoothstep(40, 160, h) * 0.8);
    }
    const w = r < EXT ? waterAt(x, z) : 0;
    if (w > 0.05) c = c.map((v, k) => v + (SHORE[k] - v) * Math.min(1, w * 2));
    const shade = 0.88 + n * 0.24;
    colors.set(c.map((v) => (v * shade) ** 2.2), i * 3);
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const detail = detailTexture().clone();
  detail.needsUpdate = true;
  detail.repeat.set(WORLD / 12, WORLD / 12);
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95 }));
  terrain.receiveShadow = true;
  group.add(terrain);

  // ---- water surface
  let waterMesh = null;
  if (hasWater) {
    if (low) {
      waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshStandardMaterial({ color: 0x143a4e, roughness: 0.08, metalness: 0.3 }));
    } else {
      waterMesh = new Water(new THREE.PlaneGeometry(WORLD, WORLD), {
        textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(), sunDirection: new THREE.Vector3(0.5, 0.6, 0.3),
        sunColor: 0xffffff, waterColor: 0x0e2c3f, distortionScale: 2.2, fog: true,
      });
    }
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 0;
    group.add(waterMesh);
  }

  // ---- roads (ribbons draped on the terrain; bridges over water)
  const roadY = (x, z, lift) => (isWater(x, z) ? 0.6 : heightAt(x, z)) + lift;
  const ribbons = { car: [], foot: [], paint: [] };
  const navPoints = [];
  const pushRibbon = (list, pts, width, lift) => {
    if (pts.length < 2) return;
    const verts = [];
    const half = width / 2;
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k];
      const [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
      let dx = xb - xa, dz = zb - za;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const nx = -dz * half, nz = dx * half;
      verts.push([x + nx, roadY(x + nx, z + nz, lift), z + nz, x - nx, roadY(x - nx, z - nz, lift), z - nz]);
    }
    const posA = [];
    for (let k = 0; k + 1 < verts.length; k++) {
      const a = verts[k], b = verts[k + 1];
      posA.push(a[0], a[1], a[2], b[0], b[1], b[2], a[3], a[4], a[5]);
      posA.push(a[3], a[4], a[5], b[0], b[1], b[2], b[3], b[4], b[5]);
    }
    list.push(posA);
  };
  // Resample polylines so ribbons follow the terrain between OSM nodes.
  const resample = (flat, start, step) => {
    const out = [];
    for (let k = start; k + 3 < flat.length; k += 2) {
      const x0 = flat[k], z0 = flat[k + 1], x1 = flat[k + 2], z1 = flat[k + 3];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step));
      for (let s = 0; s < n; s++) out.push([x0 + ((x1 - x0) * s) / n, z0 + ((z1 - z0) * s) / n]);
    }
    out.push([flat[flat.length - 2], flat[flat.length - 1]]);
    return out;
  };
  const lampSpots = [];
  for (const r of osm.roads) {
    const [width, foot] = r;
    const pts = resample(r, 2, 6);
    if (!pts.some(([x, z]) => Math.hypot(x, z) < EXT)) continue;
    pushRibbon(foot ? ribbons.foot : ribbons.car, pts, width, foot ? 0.1 : 0.12 + width * 0.002);
    // Centre-line dashes on bigger roads.
    if (!foot && width >= 9) {
      let acc = 0;
      for (let k = 0; k + 1 < pts.length; k++) {
        acc += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
        if (Math.floor(acc / 6) % 2 === 0) pushRibbon(ribbons.paint, [pts[k], pts[k + 1]], 0.18, 0.16 + width * 0.002);
      }
    }
    // Sidewalk lamps along streets, and walking routes for people.
    for (let k = 0; k < pts.length; k += 2) {
      const [x, z] = pts[k];
      if (Math.hypot(x, z) > R) continue;
      if (width <= 10 || foot) navPoints.push(new THREE.Vector2(x, z));
      if (!foot && width >= 6 && k % 10 === 0 && lampSpots.length < 320) {
        const [x2, z2] = pts[Math.min(pts.length - 1, k + 1)];
        const len = Math.hypot(x2 - x, z2 - z) || 1;
        lampSpots.push([x + (-(z2 - z) / len) * (width / 2 + 0.9), z + ((x2 - x) / len) * (width / 2 + 0.9)]);
      }
    }
  }
  const ribbonMesh = (list, material) => {
    const flatArr = list.flat();
    if (!flatArr.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(flatArr, 3));
    const uv = new Float32Array((flatArr.length / 3) * 2);
    for (let k = 0, v = 0; k < flatArr.length; k += 3, v += 2) { uv[v] = flatArr[k] / 6; uv[v + 1] = flatArr[k + 2] / 6; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  ribbonMesh(ribbons.car, new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.88, map: detail, side: THREE.DoubleSide }));
  ribbonMesh(ribbons.foot, new THREE.MeshStandardMaterial({ color: P.buildings.style === 'adobe' ? 0xb99a78 : 0x8c867c, roughness: 0.9, map: detail, side: THREE.DoubleSide }));
  ribbonMesh(ribbons.paint, new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.6, side: THREE.DoubleSide }));

  // ---- buildings: real footprints, extruded to their mapped heights
  const cityStyle = STYLES[['adobe', 'wood'].includes(P.buildings.style) ? P.buildings.style : P.buildings.style === 'glass' ? 'mixed' : P.buildings.style];
  const styleFor = [cityStyle, STYLES.glass, STYLES[['adobe', 'wood'].includes(P.buildings.style) ? P.buildings.style : 'old'], STYLES.old];
  const buckets = [[], [], [], []];
  const tmpColor = new THREE.Color();
  for (const b of osm.buildings) {
    const [h, kind] = b;
    const pts = [];
    for (let k = 2; k + 1 < b.length; k += 2) pts.push(new THREE.Vector2(b[k], -b[k + 1]));
    if (pts.length < 3) continue;
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p.x; cz -= p.y; }
    cx /= pts.length; cz /= pts.length;
    if (Math.hypot(cx, cz) > EXT) continue;
    if (isWater(cx, cz)) continue;
    let base = Infinity;
    for (let k = 0; k < pts.length; k += Math.max(1, Math.floor(pts.length / 6))) base = Math.min(base, heightAt(pts[k].x, -pts[k].y));
    base = Math.min(base, heightAt(cx, cz)) - 0.6;
    let geo;
    try {
      geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: h + 0.6, bevelEnabled: false, curveSegments: 1 });
    } catch { continue; }
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, base, 0);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    tmpColor.set(styleFor[kind].color).offsetHSL(rand.range(-0.03, 0.03), rand.range(-0.1, 0.06), rand.range(-0.14, 0.08));
    for (let v = 0; v < n; v++) col.set([tmpColor.r, tmpColor.g, tmpColor.b], v * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    buckets[kind].push(geo);
    const ring = b.slice(2);
    tops.fillPolygon(ring, base + h, 'max');
  }
  buckets.forEach((geos, kind) => {
    if (!geos.length) return;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) return;
    const mat = facadeMaterial({ ...styleFor[kind], color: 0xffffff });
    mat.vertexColors = true;
    nightHooks.push((v) => { mat.userData.night.value = v; });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  });

  // ---- a generated skyline beyond the mapped area, so the city goes on
  if (P.buildings.layout === 'grid') {
    const boxes = [];
    const [hMin, hMax] = P.buildings.h;
    const count = Math.round(360 * P.buildings.density);
    for (let k = 0; k < count * 4 && boxes.length < count; k++) {
      const r = R + 60 + Math.pow(rand(), 0.7) * 520, a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (isWater(x, z) || waterAt(x, z) > 0.1) continue;
      boxes.push({ x, z, w: rand.range(14, 34), d: rand.range(14, 34), h: hMin + (hMax - hMin) * Math.pow(rand(), 2) * 0.8, y: heightAt(x, z) });
    }
    if (boxes.length) {
      const mat = facadeMaterial(cityStyle);
      nightHooks.push((v) => { mat.userData.night.value = v; });
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, boxes.length);
      const m = new THREE.Matrix4();
      boxes.forEach((b, i) => { m.makeScale(b.w, b.h + 2, b.d).setPosition(b.x, b.y - 2, b.z); inst.setMatrixAt(i, m); });
      inst.castShadow = true;
      group.add(inst);
    }
  }

  // ---- trees: mapped trees, park and woodland planting, countryside beyond
  const treeSpots = [];
  const free = (x, z) => !isWater(x, z) && tops.get(x, z) === 0 && roadMask.get(x, z) === 0;
  for (let k = 0; k + 1 < osm.trees.length; k += 2) {
    const x = osm.trees[k], z = osm.trees[k + 1];
    if (Math.hypot(x, z) < EXT && free(x, z)) treeSpots.push({ x, z, y: heightAt(x, z), s: rand.range(0.7, 1.15), rot: rand() * 6.28 });
  }
  for (let k = 0; k < 9000 && treeSpots.length < 1400; k++) {
    const x = rand.range(-EXT, EXT), z = rand.range(-EXT, EXT);
    const g = green.get(x, z);
    if (!g || g === 3) continue;
    if (rand() > (g === 2 ? 0.7 : 0.18) || !free(x, z)) continue;
    treeSpots.push({ x, z, y: heightAt(x, z), s: rand.range(0.7, 1.25), rot: rand() * 6.28 });
  }
  for (let k = 0; k < P.trees.count * 3 && treeSpots.length < 1400 + P.trees.count * 0.6; k++) {
    const r = R + 80 + Math.sqrt(rand()) * 700, a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!isWater(x, z)) treeSpots.push({ x, z, y: heightAt(x, z), s: rand.range(0.8, 1.3), rot: rand() * 6.28 });
  }
  addTrees(group, P.trees.kind === 'jungle' || P.trees.kind === 'baobab' ? 'broadleaf' : P.trees.kind, treeSpots, rand);

  // ---- street lamps
  if (lampSpots.length) {
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 5.5, 6).translate(0, 2.75, 0), new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.6, roughness: 0.4 }), lampSpots.length);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffc98a, emissiveIntensity: 0 });
    nightHooks.push((v) => { bulbMat.emissiveIntensity = 0.3 + v * 6; });
    const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 10, 8).translate(0, 5.6, 0), bulbMat, lampSpots.length);
    const m = new THREE.Matrix4();
    lampSpots.forEach(([x, z], i) => { m.makeTranslation(x, heightAt(x, z), z); pole.setMatrixAt(i, m); bulb.setMatrixAt(i, m); });
    pole.castShadow = true;
    group.add(pole, bulb);
  }

  // ---- the Gods' datacenters, on open ground at the edge of the map
  const godSites = [];
  const openArea = (x, z, rx, rz) => {
    for (let dx = -rx; dx <= rx; dx += 6) for (let dz = -rz; dz <= rz; dz += 6) if (isWater(x + dx, z + dz) || tops.get(x + dx, z + dz) > 0) return false;
    return true;
  };
  const siteFor = () => {
    for (let k = 0; k < 400; k++) {
      const r = R * 0.55 + rand() * R * 0.9, a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (openArea(x, z, 22, 22) && !godSites.some((s) => Math.hypot(s.x - x, s.z - z) < 60)) return { x, z };
    }
    return null;
  };
  for (const [g, n] of Object.entries(polity.substrate)) {
    for (let i = 0; i < n; i++) {
      const s = siteFor();
      if (!s) continue;
      group.add(datacenter(g, s.x, heightAt(s.x, s.z), s.z).group);
      obstacles.push({ x: s.x, z: s.z, hx: 21, hz: 21, top: heightAt(s.x, s.z) + 34 });
      godSites.push({ god: g, x: s.x, z: s.z });
    }
  }

  // ---- where you arrive: open ground nearest the famous spot
  let spawn = { x: 0, z: 0 };
  outer: for (let r = 0; r < 200; r += 3) {
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (free(x, z) || (roadMask.get(x, z) && !isWater(x, z) && tops.get(x, z) === 0)) { spawn = { x, z }; break outer; }
    }
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const x = spawn.x + Math.cos(a) * 14, z = spawn.z + Math.sin(a) * 14;
    if (!isWater(x, z) && tops.get(x, z) === 0) navPoints.push(new THREE.Vector2(x, z));
  }
  if (!navPoints.length) navPoints.push(new THREE.Vector2(spawn.x, spawn.z));

  const env = {
    group, heightAt, isWater, obstacles, navPoints, water: waterMesh, turbines: [], lights: [], godSites, place: P,
    playRadius: R - 40,
    spawn,
    osm: { name: osm.name, attribution: osm.attribution, counts: osm.counts },
    setNight: (v) => { for (const fn of nightHooks) fn(v); },
    blocked(x, z, pad = 0.6) {
      let top = 0;
      for (const [dx, dz] of [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]]) top = Math.max(top, tops.get(x + dx, z + dz));
      if (top > 0) return { top };
      for (const o of obstacles) if (Math.abs(o.x - x) < o.hx + pad && Math.abs(o.z - z) < o.hz + pad) return o;
      return null;
    },
  };
  env.lineClear = (x0, z0, x1, z1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2);
    for (let s = 1; s <= n; s++) {
      const x = x0 + ((x1 - x0) * s) / n, z = z0 + ((z1 - z0) * s) / n;
      if (env.isWater(x, z) || env.blocked(x, z, 0.4)) return false;
    }
    return true;
  };
  env.setNight(night);
  return env;
}

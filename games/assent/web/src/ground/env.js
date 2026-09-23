// Builds a polity's ground-level environment: terrain, water, streets,
// buildings (windows computed in the shader, lit at night), trees,
// landmarks, and the datacenters of every God with substrate here.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { fbm, seeded, hashString, smoothstep } from './noise.js';
import { place } from './places.js';
import { KINDS } from '../engine/data.js';
import { buildOsmEnvironment } from './osmEnv.js';

export const PLAY_RADIUS = 300;
const WORLD = 1800;

// ---------------------------------------------------------------- textures

function noiseCanvasTexture(size, fn, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = r * 255;
      img.data[i + 1] = g * 255;
      img.data[i + 2] = b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

// Tileable noise (sample on a torus so edges wrap).
function tileNoise(u, v, scale, seed, oct = 4) {
  const a = u * Math.PI * 2, b = v * Math.PI * 2;
  const x = Math.cos(a) * scale, y = Math.sin(a) * scale, z = Math.cos(b) * scale, w = Math.sin(b) * scale;
  return (fbm(x + 10, z + 10, seed, oct) + fbm(y + 30, w + 30, seed + 9, oct)) * 0.5;
}

let _detail, _waterNormals;
export function detailTexture() {
  return (_detail ||= noiseCanvasTexture(256, (u, v) => {
    const n = 0.72 + tileNoise(u, v, 6, 3) * 0.5 + tileNoise(u, v, 24, 7, 2) * 0.25;
    return [n, n, n];
  }, 1));
}

export function waterNormals() {
  if (_waterNormals) return _waterNormals;
  const h = (u, v) => tileNoise(u, v, 5, 11, 4) + tileNoise(u, v, 14, 21, 3) * 0.4;
  _waterNormals = noiseCanvasTexture(256, (u, v) => {
    const e = 1 / 256;
    const dx = (h(u + e, v) - h(u - e, v)) * 18;
    const dy = (h(u, v + e) - h(u, v - e)) * 18;
    const n = new THREE.Vector3(-dx, -dy, 1).normalize();
    return [n.x * 0.5 + 0.5, n.y * 0.5 + 0.5, n.z * 0.5 + 0.5];
  });
  return _waterNormals;
}

// ---------------------------------------------------------------- building material

// Windows are computed from world position, so any box of any size gets a
// believable facade: floors every 3.4 m, lit at random when it is dark.
export function facadeMaterial({ color, glass, metalness = 0.1, roughness = 0.8, winW = 2.6, floorH = 3.4, glassMix = 0.85, litFrac = 0.55, warm = [1, 0.78, 0.45] }) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  mat.userData.night = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = mat.userData.night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vec4 wpp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          vWNorm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vec4 wpp = modelMatrix * vec4(transformed, 1.0);
          vWNorm = normalize(mat3(modelMatrix) * objectNormal);
        #endif
        vWPos = wpp.xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNorm;
        uniform float uNight;
        float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float winMask; vec2 winCell;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float wall = 1.0 - step(0.6, abs(vWNorm.y));
          float along = abs(vWNorm.x) > 0.5 ? vWPos.z : vWPos.x;
          vec2 cell = vec2(along / ${winW.toFixed(2)}, (vWPos.y - 1.0) / ${floorH.toFixed(2)});
          vec2 g = fract(cell);
          winCell = floor(cell) + floor(vWPos.xz / 97.0) * 13.0;
          winMask = wall * step(0.14, g.x) * step(g.x, 0.86) * step(0.22, g.y) * step(g.y, 0.82) * step(0.0, vWPos.y - 1.2);
          vec3 glassCol = vec3(${glass.map((v) => v.toFixed(3)).join(',')}) * (0.7 + 0.6 * hash12(winCell + 3.1));
          diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, winMask * ${glassMix.toFixed(2)});
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, winMask);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.6, winMask);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float lit = step(1.0 - ${litFrac.toFixed(2)}, hash12(winCell));
        totalEmissiveRadiance += winMask * lit * uNight * vec3(${warm.map((v) => v.toFixed(2)).join(',')}) * (0.35 + 0.5 * hash12(winCell + 7.0));`);
  };
  return mat;
}

export const STYLES = {
  glass: { color: 0x9aa7b4, glass: [0.12, 0.2, 0.28], metalness: 0.4, roughness: 0.35, winW: 1.8, floorH: 3.6, glassMix: 0.95, warm: [0.85, 0.9, 1.0] },
  concrete: { color: 0xb8b2a6, glass: [0.1, 0.13, 0.16], roughness: 0.85 },
  mixed: { color: 0xa9a49a, glass: [0.12, 0.17, 0.22], roughness: 0.7, metalness: 0.2 },
  adobe: { color: 0xc49a6c, glass: [0.08, 0.07, 0.06], roughness: 0.95, winW: 4.2, glassMix: 0.9, litFrac: 0.45 },
  wood: { color: 0x8a5a3b, glass: [0.12, 0.13, 0.15], roughness: 0.9, winW: 3.6, litFrac: 0.6 },
  old: { color: 0xd9ccb4, glass: [0.1, 0.12, 0.14], roughness: 0.85, winW: 3.0, floorH: 4.0 },
};

// ---------------------------------------------------------------- builder

export function buildEnvironment(polity, state, { night = 0, low = false, osm = null } = {}) {
  // Real streets and buildings from OpenStreetMap when we have them.
  if (osm) {
    try {
      return buildOsmEnvironment(polity, state, { night, low }, osm);
    } catch (e) {
      console.warn('OSM scene failed, using the generated one instead', e);
    }
  }
  const P = place(polity.id);
  const rand = seeded(hashString(polity.id) ^ 0x51f15);
  const seed = hashString(polity.id) % 1000;
  const group = new THREE.Group();
  const obstacles = []; // { x, z, hx, hz } axis-aligned footprints
  const lights = [];
  const nightHooks = []; // called with 0 (day) … 1 (night)

  // ---- terrain height field
  const waterLevel = P.water ? 0 : -999;
  const waterDepth = (x, z) => {
    switch (P.water) {
      case 'sea': { const edge = 170 + fbm(z * 0.004, 0, seed) * 90; return smoothstep(edge, edge + 60, x); }
      case 'fjord': { const edge = 120 + fbm(z * 0.006, 1, seed) * 60; return smoothstep(edge, edge + 40, x); }
      case 'river': { const cx = Math.sin(z * 0.006 + seed) * 60 + 120; return 1 - smoothstep(18, 34, Math.abs(x - cx)); }
      case 'delta': {
        let d = 0;
        for (let i = 0; i < 4; i++) {
          const cx = Math.sin(z * 0.008 + i * 1.7 + seed) * 50 - 150 + i * 95;
          d = Math.max(d, 1 - smoothstep(9, 18, Math.abs(x - cx)));
        }
        return d;
      }
      default: return 0;
    }
  };
  const heightAt = (x, z) => {
    const r = Math.hypot(x, z);
    const city = smoothstep(90, 260, r);
    let h = (fbm(x * 0.006, z * 0.006, seed, 5) - 0.5) * P.hills * (0.25 + city);
    h += smoothstep(320, 800, r) * P.mountains * fbm(x * 0.003 + 5, z * 0.003 + 5, seed + 3, 5) * 1.6;
    h += smoothstep(300, 700, r) * 30; // a gentle bowl that hides the world's edge
    if (P.water) h = Math.max(h, 0) + 2.5; // dry land sits above the waterline
    const w = waterDepth(x, z);
    if (w > 0) h = h * (1 - w) + (-6 - P.hills * 0.2) * w;
    return h;
  };
  const isWater = (x, z) => P.water && heightAt(x, z) < waterLevel + 0.4;

  const terrainGeo = new THREE.PlaneGeometry(WORLD, WORLD, 256, 256);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const pal = P.palette;
  const snowy = P.terrain === 'snow';
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.02, z * 0.02, seed + 7, 3);
    const t = smoothstep(0, 60, h) * 0.6 + n * 0.4;
    let c = pal.low.map((v, k) => v + (pal.high[k] - v) * t);
    const rock = smoothstep(40, 140, h) * 0.8;
    c = c.map((v, k) => v + (pal.rock[k] - v) * rock);
    if (h > 110 || (snowy && h > 5)) c = c.map((v) => v + (0.93 - v) * smoothstep(snowy ? 5 : 110, snowy ? 30 : 200, h));
    if (P.water && h < 0.8) c = [0.52, 0.47, 0.36].map((v, k) => v + (c[k] - v) * smoothstep(-2, 0.8, h)); // shore
    if (P.props.includes('fields') && Math.hypot(x, z) > 120 && Math.hypot(x, z) < 330) {
      const fx = Math.floor(x / 34), fz = Math.floor(z / 22);
      const f = (Math.abs(Math.sin(fx * 12.9 + fz * 78.2)) * 43758) % 1;
      if (f > 0.35) c = [[0.36, 0.45, 0.16], [0.58, 0.52, 0.22], [0.28, 0.38, 0.12], [0.5, 0.4, 0.25]][Math.floor(f * 4) % 4];
    }
    if (P.props.includes('terraces') && h > 8) c = c.map((v, k) => v * (0.85 + 0.15 * Math.sin(h * 1.2)) + (k === 1 ? 0.03 : 0));
    colors.set(c.map((v) => v ** 2.2), i * 3); // palette is sRGB; vertex colours are linear
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const detail = detailTexture().clone();
  detail.needsUpdate = true;
  detail.repeat.set(WORLD / 14, WORLD / 14);
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.96 }));
  terrain.receiveShadow = true;
  group.add(terrain);

  // Paved plaza at the centre, where people gather.
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: P.terrain === 'sand' || P.buildings.style === 'adobe' ? 0xc2a27c : 0x8d8a84, roughness: 0.8, map: detail }),
  );
  plaza.position.y = heightAt(0, 0) + 0.08;
  plaza.receiveShadow = true;
  group.add(plaza);

  // ---- water
  let water = null;
  if (P.water && low) {
    // Low graphics: a plain glossy plane instead of real-time reflections.
    water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshStandardMaterial({ color: P.terrain === 'jungle' ? 0x1d3b2c : 0x123a52, roughness: 0.08, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = waterLevel;
    group.add(water);
  } else if (P.water) {
    const wn = waterNormals();
    water = new Water(new THREE.PlaneGeometry(WORLD, WORLD), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: wn,
      sunDirection: new THREE.Vector3(0.5, 0.6, 0.3),
      sunColor: 0xffffff,
      waterColor: P.terrain === 'jungle' ? 0x1d3b2c : 0x0e2c3f,
      distortionScale: 2.2,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = waterLevel;
    group.add(water);
  }

  // ---- streets (grid layouts)
  const grid = P.buildings.layout === 'grid';
  const block = 46, street = 12;
  const navPoints = [];
  if (grid) {
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.9, map: detail });
    const roads = new THREE.Group();
    for (let k = -6; k <= 6; k++) {
      const c = k * block;
      for (const horiz of [true, false]) {
        const len = PLAY_RADIUS * 2;
        const g = new THREE.PlaneGeometry(horiz ? len : street, horiz ? street : len, horiz ? 120 : 2, horiz ? 2 : 120).rotateX(-Math.PI / 2);
        const pa = g.attributes.position;
        // Drape each road over the terrain; skip stretches under water.
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i) + (horiz ? 0 : c), z = pa.getZ(i) + (horiz ? c : 0);
          pa.setY(i, isWater(x, z) ? -30 : heightAt(x, z) + 0.06);
        }
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, asphalt);
        m.position.set(horiz ? 0 : c, 0, horiz ? c : 0);
        m.receiveShadow = true;
        roads.add(m);
      }
    }
    group.add(roads);
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
      const x = i * block, z = j * block;
      if (Math.hypot(x, z) < PLAY_RADIUS - 20 && !isWater(x, z)) navPoints.push(new THREE.Vector2(x, z));
    }
  }

  // ---- buildings
  const style = STYLES[P.buildings.style];
  const bMat = facadeMaterial(style);
  nightHooks.push((v) => { bMat.userData.night.value = v; });
  const boxes = [];
  const tryPlace = (x, z, w, d, h) => {
    if (Math.hypot(x, z) < 42 || Math.hypot(x, z) > PLAY_RADIUS + 120) return false;
    for (const [dx, dz] of [[0, 0], [w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]]) if (isWater(x + dx, z + dz)) return false;
    for (const o of obstacles) if (Math.abs(o.x - x) < o.hx + w / 2 + 2 && Math.abs(o.z - z) < o.hz + d / 2 + 2) return false;
    obstacles.push({ x, z, hx: w / 2, hz: d / 2, top: heightAt(x, z) + h + (P.roof === 'gable' ? Math.min(w, 8) * 0.5 : 0) });
    boxes.push({ x, z, w, d, h, y: heightAt(x, z) });
    return true;
  };
  const [hMin, hMax] = P.buildings.h;
  const tallness = (x, z) => {
    const r = Math.hypot(x, z);
    return hMin + (hMax - hMin) * Math.pow(rand(), 2.2) * (1 - smoothstep(60, PLAY_RADIUS + 100, r) * 0.7);
  };
  if (grid) {
    for (let i = -7; i <= 6; i++) for (let j = -7; j <= 6; j++) {
      const cx = i * block + block / 2, cz = j * block + block / 2;
      const inner = block - street - 4;
      const lots = rand() < 0.5 ? 1 : 2;
      for (let a = 0; a < lots; a++) for (let b = 0; b < lots; b++) {
        if (rand() > P.buildings.density) continue;
        const s = inner / lots;
        const w = s - rand.range(1, 4), d = s - rand.range(1, 4);
        const x = cx - inner / 2 + s * (a + 0.5), z = cz - inner / 2 + s * (b + 0.5);
        tryPlace(x, z, w, d, Math.max(4, tallness(x, z) * (lots === 2 ? 0.6 : 1)));
      }
    }
  } else {
    const n = Math.floor(260 * P.buildings.density);
    for (let k = 0; k < n * 3 && boxes.length < n; k++) {
      const r = 45 + Math.pow(rand(), 0.8) * (PLAY_RADIUS + 60);
      const a = rand() * Math.PI * 2;
      const w = rand.range(6, 14), d = rand.range(6, 12);
      tryPlace(Math.cos(a) * r, Math.sin(a) * r, w, d, Math.max(3, tallness(Math.cos(a) * r, Math.sin(a) * r)));
    }
    for (let k = 0; k < 60; k++) {
      const r = 40 + rand() * (PLAY_RADIUS - 60), a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!isWater(x, z)) navPoints.push(new THREE.Vector2(x, z));
    }
  }
  if (boxes.length) {
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const inst = new THREE.InstancedMesh(geo, bMat, boxes.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    boxes.forEach((b, i) => {
      m.makeScale(b.w, b.h + 2, b.d).setPosition(b.x, b.y - 2, b.z);
      inst.setMatrixAt(i, m);
      col.set(style.color).offsetHSL(rand.range(-0.03, 0.03), rand.range(-0.08, 0.05), rand.range(-0.12, 0.08));
      inst.setColorAt(i, col);
    });
    inst.castShadow = inst.receiveShadow = true;
    group.add(inst);
    if (P.roof === 'gable') {
      const roofGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 2);
      roofGeo.rotateY(Math.PI / 2);
      const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: P.terrain === 'snow' ? 0x3a2a24 : 0x7a3a2a, roughness: 0.8 }), boxes.length);
      boxes.forEach((b, i) => {
        m.makeScale(b.w * 1.15, b.d * 1.08, Math.min(b.w, 8) * 0.9).setPosition(b.x, b.y + b.h + Math.min(b.w, 8) * 0.18, b.z);
        roofs.setMatrixAt(i, m);
      });
      roofs.castShadow = true;
      group.add(roofs);
    }
  }

  // ---- trees
  const treeSpots = [];
  for (let k = 0; k < P.trees.count * 3 && treeSpots.length < P.trees.count; k++) {
    const r = 35 + Math.sqrt(rand()) * 700;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (isWater(x, z)) continue;
    if (obstacles.some((o) => Math.abs(o.x - x) < o.hx + 1.5 && Math.abs(o.z - z) < o.hz + 1.5)) continue;
    if (grid && r < PLAY_RADIUS + 40 && (Math.abs(((x % block) + block) % block) < street / 2 + 1 || Math.abs(((z % block) + block) % block) < street / 2 + 1)) {
      // Street trees along the kerb only.
      if (rand() < 0.6) continue;
    }
    const y = heightAt(x, z);
    if (y > 150 && P.trees.kind !== 'conifer') continue;
    treeSpots.push({ x, z, y, s: rand.range(0.7, 1.35), rot: rand() * Math.PI * 2 });
  }
  addTrees(group, P.trees.kind, treeSpots, rand);

  // ---- props & landmarks
  const props = new Set(P.props);
  if (props.has('lanterns')) {
    const pts = [];
    for (let k = 0; k < 90; k++) {
      const a = rand() * Math.PI * 2, r = 32 + rand() * 230;
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (grid) { x = Math.round(x / block) * block + street / 2 + 0.8; }
      if (!isWater(x, z)) pts.push([x, heightAt(x, z), z]);
    }
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; pts.push([Math.cos(a) * 31, heightAt(0, 0), Math.sin(a) * 31]); }
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 5.5, 6).translate(0, 2.75, 0), new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.6, roughness: 0.4 }), pts.length);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffc98a, emissiveIntensity: 0 });
    nightHooks.push((v) => { bulbMat.emissiveIntensity = 0.3 + v * 6; });
    const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 12, 8).translate(0, 5.6, 0), bulbMat, pts.length);
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); pole.setMatrixAt(i, m); bulb.setMatrixAt(i, m); });
    pole.castShadow = true;
    group.add(pole, bulb);
  }
  if (props.has('stalls')) {
    const n = 26;
    const base = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.9, 1.4).translate(0, 0.45, 0), new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 }), n);
    const canopy = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 0.08, 2).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.1;
      const x = Math.cos(a) * 24, z = Math.sin(a) * 24;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
      m.compose(new THREE.Vector3(x, heightAt(x, z), z), q, new THREE.Vector3(1, 1, 1));
      base.setMatrixAt(i, m);
      canopy.setMatrixAt(i, m);
      canopy.setColorAt(i, c.setHSL(rand(), 0.55, 0.5));
      obstacles.push({ x, z, hx: 1.3, hz: 1.3, top: heightAt(x, z) + 2.5 });
    }
    base.castShadow = canopy.castShadow = true;
    group.add(base, canopy);
  }
  if (props.has('solar')) {
    const rows = [];
    for (let i = 0; i < 16; i++) for (let j = 0; j < 30; j++) {
      const x = -260 + j * 7, z = 190 + i * 9;
      if (!isWater(x, z) && Math.hypot(x, z) < 520) rows.push([x, heightAt(x, z), z]);
    }
    const panel = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 0.12, 3.2), new THREE.MeshStandardMaterial({ color: 0x0e1a2e, metalness: 0.7, roughness: 0.18 }), rows.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, 0));
    rows.forEach((r, i) => { m.compose(new THREE.Vector3(r[0], r[1] + 1.4, r[2]), q, new THREE.Vector3(1, 1, 1)); panel.setMatrixAt(i, m); });
    panel.castShadow = true;
    group.add(panel);
  }
  const turbines = [];
  if (props.has('turbines')) {
    const white = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
    for (let i = 0; i < 7; i++) {
      const a = 0.4 + i * 0.28, r = 380 + (i % 2) * 70;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = heightAt(x, z);
      const t = new THREE.Group();
      t.position.set(x, y, z);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 90, 12).translate(0, 45, 0), white);
      const hub = new THREE.Group();
      hub.position.y = 90;
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 42, 0.4).translate(0, 21, 0), white);
        blade.rotation.z = (b / 3) * Math.PI * 2;
        hub.add(blade);
      }
      hub.rotation.y = -a + Math.PI;
      t.add(tower, hub);
      tower.castShadow = true;
      group.add(t);
      turbines.push(hub.children.length ? hub : null);
    }
  }
  if (props.has('spire')) group.add(landmarkSpire(heightAt(-70, -70), -70, -70, obstacles));
  if (props.has('temple')) group.add(landmarkTemple(heightAt(70, -80), 70, -80, obstacles));
  if (props.has('torii')) group.add(landmarkTorii(heightAt(0, -38), 0, -38));
  if (props.has('seawall')) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 9, WORLD), new THREE.MeshStandardMaterial({ color: 0x8b8680, roughness: 0.9 }));
    let edge = 0;
    for (let x = 0; x < 600; x += 2) if (isWater(x, 0)) { edge = x; break; }
    wall.position.set(edge - 6, 0, 0);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
  }
  if (props.has('stilts') && P.water) {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 });
    const hutMat = facadeMaterial({ ...STYLES.wood, color: 0x9a6b44 });
    nightHooks.push((v) => { hutMat.userData.night.value = v; });
    let placed = 0;
    for (let k = 0; k < 900 && placed < 36; k++) {
      const x = rand.range(-PLAY_RADIUS, PLAY_RADIUS), z = rand.range(-PLAY_RADIUS, PLAY_RADIUS);
      if (!isWater(x, z) || heightAt(x, z) < -5) continue;
      const hut = new THREE.Group();
      hut.position.set(x, 0, z);
      for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6), legMat);
        leg.position.set(dx, -1, dz);
        hut.add(leg);
      }
      const body = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3, 5.5).translate(0, 3.5, 0), hutMat);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.5, 4).translate(0, 6.2, 0), new THREE.MeshStandardMaterial({ color: 0x7c6a3c, roughness: 1 }));
      roof.rotation.y = Math.PI / 4;
      body.castShadow = roof.castShadow = true;
      hut.add(body, roof);
      group.add(hut);
      obstacles.push({ x, z, hx: 2.8, hz: 2.8, top: 8 });
      placed++;
    }
  }

  // ---- the Gods' datacenters (their substrate here)
  const godSites = [];
  let slot = 0;
  for (const [g, n] of Object.entries(polity.substrate)) {
    for (let i = 0; i < n; i++) {
      const a = 2.2 + slot * 0.55;
      const x = Math.cos(a) * 200, z = Math.sin(a) * 200;
      slot++;
      if (isWater(x, z)) continue;
      const site = datacenter(g, x, heightAt(x, z), z);
      group.add(site.group);
      obstacles.push({ x, z, hx: 21, hz: 13, top: heightAt(x, z) + 34 });
      godSites.push({ god: g, x, z });
    }
  }

  if (!navPoints.length) navPoints.push(new THREE.Vector2(0, 0));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; navPoints.push(new THREE.Vector2(Math.cos(a) * 18, Math.sin(a) * 18)); }

  const setNight = (v) => { for (const fn of nightHooks) fn(v); };
  setNight(night);

  const env = {
    group, heightAt, isWater, obstacles, navPoints, water, turbines, lights, godSites, setNight, place: P,
    playRadius: PLAY_RADIUS,
    spawn: { x: 0, z: 55 },
    blocked(x, z, pad = 0.6) {
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
  return env;
}

// ---------------------------------------------------------------- trees

export function addTrees(group, kind, spots, rand) {
  if (!spots.length) return;
  const bark = new THREE.MeshStandardMaterial({ color: kind === 'birch' ? 0xd9d4c8 : kind === 'eucalyptus' ? 0xb9ab95 : 0x4a3524, roughness: 0.95 });
  const leafColor = { conifer: 0x1f3a24, broadleaf: 0x3d5e2a, jungle: 0x2a5220, palm: 0x4d6f2c, baobab: 0x5b6d2e, birch: 0x6c8a3a, acacia: 0x5b6f2f, eucalyptus: 0x6d7f5a }[kind];
  const leaf = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.85, flatShading: true });
  let trunkGeo, crownGeo, crownY, trunkH;
  switch (kind) {
    case 'conifer':
      trunkH = 3; trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, trunkH, 6).translate(0, trunkH / 2, 0);
      crownGeo = new THREE.ConeGeometry(3.2, 14, 8).translate(0, 9.5, 0); crownY = 0; break;
    case 'palm':
      trunkH = 11; trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, trunkH, 6).translate(0, trunkH / 2, 0);
      crownGeo = palmCrown(); crownY = trunkH; break;
    case 'baobab':
      trunkH = 8; trunkGeo = new THREE.CylinderGeometry(0.9, 2.1, trunkH, 9).translate(0, trunkH / 2, 0);
      crownGeo = new THREE.IcosahedronGeometry(3.2, 1).scale(1.25, 0.55, 1.25); crownY = trunkH + 0.9; break;
    case 'acacia':
      trunkH = 5; trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, trunkH, 6).translate(0, trunkH / 2, 0);
      crownGeo = new THREE.SphereGeometry(4, 9, 5).scale(1.5, 0.3, 1.5); crownY = trunkH + 0.6; break;
    case 'birch':
      trunkH = 9; trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, trunkH, 6).translate(0, trunkH / 2, 0);
      crownGeo = new THREE.IcosahedronGeometry(2.6, 1).scale(0.9, 1.5, 0.9); crownY = trunkH; break;
    case 'jungle':
      trunkH = 14; trunkGeo = new THREE.CylinderGeometry(0.4, 0.7, trunkH, 7).translate(0, trunkH / 2, 0);
      crownGeo = new THREE.IcosahedronGeometry(5.5, 1).scale(1.2, 0.7, 1.2); crownY = trunkH + 1; break;
    case 'eucalyptus':
      trunkH = 12; trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, trunkH, 6).translate(0, trunkH / 2, 0);
      crownGeo = new THREE.IcosahedronGeometry(3.4, 1).scale(1, 1.4, 1); crownY = trunkH + 1; break;
    default:
      trunkH = 4; trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, trunkH, 6).translate(0, trunkH / 2, 0);
      crownGeo = new THREE.IcosahedronGeometry(3.6, 1); crownY = trunkH + 2.2;
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, bark, spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, leaf, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  spots.forEach((s, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    m.compose(new THREE.Vector3(s.x, s.y - 0.2, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(s.x, s.y + crownY * s.s, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, c.set(leafColor).offsetHSL(rand.range(-0.03, 0.03), 0, rand.range(-0.06, 0.06)));
  });
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  group.add(trunks, crowns);
}

function palmCrown() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.ConeGeometry(0.9, 6.5, 4).scale(1, 1, 0.2).translate(0, 3.2, 0);
    g.rotateX(1.25);
    g.rotateY((i / 7) * Math.PI * 2);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

function mergeGeometries(geos) {
  const merged = new THREE.BufferGeometry();
  const pos = [], norm = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    ng.computeVertexNormals();
    norm.push(...ng.attributes.normal.array);
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  return merged;
}

// ---------------------------------------------------------------- landmarks

function landmarkSpire(y, x, z, obstacles) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x9c9384, roughness: 0.9 });
  const nave = new THREE.Mesh(new THREE.BoxGeometry(18, 26, 50).translate(0, 13, 0), stone);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 50, 12).translate(0, 25, -28), stone);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(8, 60, 4).translate(0, 80, -28), new THREE.MeshStandardMaterial({ color: 0x4f5a58, roughness: 0.6, metalness: 0.3 }));
  spire.rotation.y = Math.PI / 4;
  for (const m of [nave, tower, spire]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  g.position.set(x, y, z);
  obstacles.push({ x, z: z - 6, hx: 10, hz: 32, top: y + 110 });
  return g;
}

function landmarkTemple(y, x, z, obstacles) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.85 });
  for (let i = 0; i < 9; i++) {
    const s = 22 - i * 2.2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, 4.5, s).translate(0, 2.25 + i * 4.3, 0), stone);
    m.castShadow = true;
    g.add(m);
  }
  const top = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8).translate(0, 42, 0), new THREE.MeshStandardMaterial({ color: 0xd4a53c, metalness: 0.9, roughness: 0.25 }));
  g.add(top);
  g.position.set(x, y, z);
  obstacles.push({ x, z, hx: 12, hz: 12, top: y + 44 });
  return g;
}

function landmarkTorii(y, x, z) {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xb8321f, roughness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  for (const dx of [-4, 4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 9, 12).translate(dx, 4.5, 0), red); p.castShadow = true; g.add(p); }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(12, 0.9, 1).translate(0, 9.4, 0), black));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(10, 0.7, 0.8).translate(0, 7.6, 0), red));
  g.position.set(x, y, z);
  return g;
}

export function datacenter(god, x, y, z) {
  const g = new THREE.Group();
  const color = new THREE.Color(KINDS[god].color);
  const shell = new THREE.MeshStandardMaterial({ color: god === 'verdance' ? 0x2c4a2e : 0x16181c, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 24).translate(0, 8, 0), shell);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const glow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 2.4 });
  for (let i = 0; i < 5; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(40.2, 0.35, 24.2).translate(0, 2.5 + i * 3, 0), glow);
    g.add(seam);
  }
  // Cooling towers breathing heat into the sky.
  for (const dx of [-12, 0, 12]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 10, 16).translate(dx, 21, 0), shell);
    t.castShadow = true;
    g.add(t);
  }
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(2.2).translate(0, 32, 0), glow);
  g.add(beacon);
  const light = new THREE.PointLight(color, 400, 90, 2);
  light.position.set(0, 20, 16);
  g.add(light);
  g.position.set(x, y, z);
  g.lookAt(0, y, 0);
  g.userData.beacon = beacon;
  return { group: g };
}
